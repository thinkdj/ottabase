import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { autoInit, getAllModelsMetadata } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { ottablogOrgModeSuppressedIndexes } from '@ottabase/ottablog';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { getAllSchemas } from '../../ottabase/db/schemas-helper';
import { buildAppMigrations } from '../../ottabase/migrations';
import { checkMigrationAuth, initDbConnection } from '../lib/db-utils';
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

    // Org-mode blogs: the index-swap migration runs once (tracked), but autoInit's
    // ensure step re-creates schema-declared indexes on EVERY run — suppress the
    // dropped strict slug indexes so a re-init can't silently restore app-wide
    // uniqueness and break per-org slug namespaces. Env-aware (OTTABLOG_MODE).
    const ottabaseConfig = getOttabaseConfig(env);
    const blogOrgMode = ottabaseConfig.packages.ottablog && ottabaseConfig.features.ottablog.mode === 'org';

    const result = await autoInit({
        driver,
        schema: allSchemas,
        customMigrations: buildAppMigrations(env as unknown as Record<string, unknown>),
        verbose: true,
        allowDestructive,
        suppressIndexes: blogOrgMode ? ottablogOrgModeSuppressedIndexes : [],
    });

    // Seed default brand kit + route mappings for current app (brand kits are always app-scoped)
    if (result.success) {
        initDbConnection(env);
        const appId = (env as { APP_ID?: string }).APP_ID ?? 'otta-web';
        await ensureAppBrandDefaults('Ottabase', appId);
    }

    return jsonResponse(result);
}
