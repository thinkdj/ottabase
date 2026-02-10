import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { autoInit, getAllModelsMetadata } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getAllSchemas } from '../../ottabase/db/schemas-helper';
import { appMigrations } from '../../ottabase/migrations';
import { checkMigrationAuth } from '../lib/db-utils';

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

    const isAuthorized = await checkMigrationAuth(request, env);
    if (!isAuthorized) {
        return errorResponse('Unauthorized - MIGRATION_SECRET required in production', 401, {
            code: 'UNAUTHORIZED',
        });
    }

    const driver = createD1Driver(env.OBCF_D1);
    const allSchemas = getAllSchemas();
    const result = await autoInit({
        driver,
        schema: allSchemas,
        customMigrations: appMigrations,
        verbose: true,
        // Allow destructive migrations only when explicitly enabled via env
        allowDestructive:
            env.MIGRATION_ALLOW_DESTRUCTIVE?.trim().toLowerCase() === '1' ||
            env.MIGRATION_ALLOW_DESTRUCTIVE?.trim().toLowerCase() === 'true',
    });

    return jsonResponse(result);
}
