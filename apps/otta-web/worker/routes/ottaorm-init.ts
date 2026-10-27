import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { applyPackageLifecycle, createKvInstallStore, createMemoryInstallStore } from '@ottabase/kernel';
import { autoInit, getAllModelsMetadata } from '@ottabase/ottaorm';
import { LandingSite } from '@ottabase/ottalanding'; // otta:only ottalanding
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { getAllSchemas } from '../../ottabase/db/schemas-helper';
import { buildAppMigrations } from '../../ottabase/migrations';
import { packages } from '../../ottabase/packages';
import { checkMigrationAuth, initDbConnection } from '../lib/db-utils';
import { ensurePackageSchedules } from '../lib/package-schedules';
import { ensureAppBrandDefaults } from '../lib/user-provisioning';

export interface OttaormInitContext {
    request: Request;
    env: CloudflareEnv;
}

export function handleModelsMetadata(): Response {
    const metadataMap = getAllModelsMetadata();
    const models = Array.from(metadataMap.entries()).map(([entityName, entry]) => ({
        entityName,
        modelName: entry.metadata.modelName,
        packageName: entry.metadata.packageName,
        packageType: entry.metadata.packageType,
        tableName: entry.metadata.tableName,
        displayName: entry.model.displayName,
        displayNamePlural: entry.model.displayNamePlural,
    }));
    return jsonResponse({
        models,
        total: models.length,
    });
}

export async function handleOttaormInit(context: OttaormInitContext): Promise<Response> {
    const { env, request } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    // Clone request BEFORE any body reads so we can read it twice
    const requestForAuth = request.clone();
    const requestForOptions = request.clone();

    const isAuthorized = await checkMigrationAuth(requestForAuth, env);
    if (!isAuthorized) {
        return errorResponse('Unauthorized - MIGRATION_SECRET required in production', 401, {
            code: 'UNAUTHORIZED',
        });
    }

    // Parse request body for options (using the second clone)
    let allowDestructiveFromBody = false;
    try {
        const body = (await requestForOptions.json()) as { allowDestructive?: boolean };
        allowDestructiveFromBody = body.allowDestructive === true;
    } catch {
        // Body parsing failed or no body - ignore
    }

    const driver = createD1Driver(env.OBCF_D1);
    const allSchemas = getAllSchemas();

    // Allow destructive migrations when:
    // 1. Explicitly enabled via env var MIGRATION_ALLOW_DESTRUCTIVE=true/1
    // 2. Or passed in request body as allowDestructive: true (for UI checkbox)
    const allowDestructive =
        allowDestructiveFromBody ||
        env.MIGRATION_ALLOW_DESTRUCTIVE?.trim().toLowerCase() === '1' ||
        env.MIGRATION_ALLOW_DESTRUCTIVE?.trim().toLowerCase() === 'true';

    const ottabaseConfig = getOttabaseConfig(env);

    const result = await autoInit({
        driver,
        schema: allSchemas,
        customMigrations: buildAppMigrations(),
        verbose: true,
        allowDestructive,
        // Indexes a package's migration dropped on purpose (org-mode blog slugs); autoInit's
        // ensure step would otherwise re-create them on every run.
        suppressIndexes: packages.suppressIndexes(),
    });

    if (result.success) {
        initDbConnection(env);
        // Default brand kit + route mappings for the current app (brand kits are always app-scoped)
        await ensureAppBrandDefaults('Ottabase', ottabaseConfig.appId);
        // Every package's scheduled housekeeping (audit retention, …), once per app
        const seededTasks = await ensurePackageSchedules(packages, ottabaseConfig.appId);
        // onInstall / onUpgrade for packages seen for the first time or at a new version
        const lifecycle = await applyPackageLifecycle({
            registry: packages,
            env,
            store: env.OBCF_KV
                ? createKvInstallStore(env.OBCF_KV, `${ottabaseConfig.storage.prefix}:packages:`)
                : createMemoryInstallStore(),
        });
        // otta:begin ottalanding
        // Starter landing site, so the public site has content the moment the tables exist
        if (packages.has('ottalanding')) await LandingSite.ensureForApp(ottabaseConfig.appId);
        // otta:end ottalanding
        return jsonResponse({ ...result, packages: { seededTasks, lifecycle } });
    }

    return jsonResponse(result);
}
