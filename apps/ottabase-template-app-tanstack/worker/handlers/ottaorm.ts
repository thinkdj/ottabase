/**
 * OttaORM - Generic CRUD and initialization endpoints
 * Handles: /api/ottaorm/:model/:id? and metadata/init routes
 */

import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { parseCrudRequest, handleCrud, getAllModelsMetadata, autoInit } from '@ottabase/ottaorm';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { getAllSchemas } from '../../ottabase/db/schemas-helper';
import { appMigrations } from '../../ottabase/migrations';
import { checkMigrationAuth } from '../utils/db';

/**
 * Generic CRUD handler for all OttaORM models
 * Handles: /api/ottaorm/:model/:id?
 * Supports: GET (list/get), POST (create), PATCH (update), DELETE (delete)
 */
export async function handleOttaorm(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    // Parse the CRUD request
    const crudRequest = await parseCrudRequest(request, url, '/api/ottaorm');

    if (!crudRequest) {
        return errorResponse('Invalid CRUD request', 400, {
            code: 'INVALID_REQUEST',
            hint: 'Use /api/ottaorm/{model}/{id?} format',
        });
    }

    // Execute CRUD operation
    const result = await handleCrud(crudRequest);

    // Return response
    if (!result.success) {
        return errorResponse(result.error || 'Unknown error', result.status, {
            code: result.code,
            details: result.details,
            hint: result.hint,
            messages: result.messages,
            fieldErrors: result.fieldErrors,
        });
    }

    return jsonResponse(result.data, result.status);
}

/**
 * Get metadata for all registered models
 * Handles: GET /api/ottaorm/models-metadata
 */
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

/**
 * Initialize database with auto-migrations
 * Handles: GET/POST /api/ottaorm/init
 */
export async function handleOttaormInit(request: Request, env: CloudflareEnv): Promise<Response> {
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

    // Run auto-migrations
    const driver = createD1Driver(env.OBCF_D1);
    const allSchemas = getAllSchemas();

    const result = await autoInit({
        driver,
        schema: allSchemas,
        customMigrations: appMigrations,
        verbose: true,
    });

    return jsonResponse(result);
}
