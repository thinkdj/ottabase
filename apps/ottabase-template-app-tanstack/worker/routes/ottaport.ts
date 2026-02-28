// ============================================================
// OttaPort Worker Routes — Import/Export API Endpoints
// ============================================================

import { AuditLog } from '@ottabase/ottaorm';
import { getModel, getRegisteredModels, getAllModelsMetadata } from '@ottabase/ottaorm';
import { PortJob, parseFileContent, processExport, processImport } from '@ottabase/ottaport';
import type { ExportConfig, FieldMapping, FileFormat, ImportConfig } from '@ottabase/ottaport';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminAccess } from '../lib/admin-guard';
import type { ApiRouteContext } from './router';

/** Sanitize a filename to prevent path traversal — strips directory components and unsafe chars */
function sanitizeFilename(name: string): string {
    // Remove directory components (path traversal)
    const basename = name.split(/[\\/]/).pop() || 'upload';
    // Keep only safe characters
    return basename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'upload';
}

// ============================================================
// GET /api/admin/ottaport/models — List available models for import/export
// ============================================================
export async function handleOttaportModels(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const models = getRegisteredModels();
    const metadata = getAllModelsMetadata();

    const modelList = models.map((name) => {
        const meta = metadata.find((m: any) => m.entity === name);
        const Model = getModel(name);
        const fields = Model?.getFieldDescriptors?.() ?? {};

        return {
            entity: name,
            displayName: (Model as any)?.displayName || name,
            displayNamePlural: (Model as any)?.displayNamePlural || name,
            fields: Object.entries(fields).map(([key, desc]: [string, any]) => ({
                name: key,
                type: desc.type || 'string',
                label: desc.uiConfig?.label || key,
                required: desc.required ?? false,
                editable: desc.editable ?? true,
                filterable: desc.filterable ?? false,
                searchable: desc.searchable ?? false,
            })),
            primaryKey: (Model as any)?.primaryKey || 'id',
        };
    });

    return jsonResponse({ data: modelList });
}

// ============================================================
// POST /api/admin/ottaport/import/parse — Parse uploaded file and return headers + preview
// ============================================================
export async function handleOttaportImportParse(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    try {
        const formData = await context.request.formData();
        const file = formData.get('file') as File | null;
        const format = (formData.get('format') as FileFormat) || 'csv';

        if (!file) {
            return errorResponse('No file provided', 400, { code: 'MISSING_FILE' });
        }

        const content = await file.text();
        const parsed = parseFileContent(content, format);

        // Optionally save file to R2
        let r2Key: string | undefined;
        const saveToR2 = formData.get('saveToR2') === 'true';
        if (saveToR2 && context.env.OBCF_R2) {
            const timestamp = Date.now();
            r2Key = `ottaport/imports/${timestamp}-${sanitizeFilename(file.name)}`;
            await context.env.OBCF_R2.put(r2Key, content, {
                httpMetadata: { contentType: file.type || 'text/plain' },
                customMetadata: { originalName: sanitizeFilename(file.name), uploadedAt: new Date().toISOString() },
            });
        }

        return jsonResponse({
            data: {
                headers: parsed.headers,
                preview: parsed.rows.slice(0, 5),
                totalRows: parsed.totalRows,
                format: parsed.format,
                filename: file.name,
                r2Key,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to parse file';
        return errorResponse(message, 400, { code: 'PARSE_ERROR' });
    }
}

// ============================================================
// POST /api/admin/ottaport/import/execute — Execute import with field mappings
// ============================================================
export async function handleOttaportImportExecute(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    try {
        const formData = await context.request.formData();
        const file = formData.get('file') as File | null;
        const configJson = formData.get('config') as string | null;

        if (!file || !configJson) {
            return errorResponse('File and config are required', 400, { code: 'MISSING_DATA' });
        }

        const config: ImportConfig = JSON.parse(configJson);
        const format = (formData.get('format') as FileFormat) || 'csv';

        // Validate that the target model exists
        const targetModel = getModel(config.modelEntity);
        if (!targetModel) {
            return errorResponse(`Model '${config.modelEntity}' not found`, 404, { code: 'MODEL_NOT_FOUND' });
        }

        // Validate field mappings against actual model fields
        const modelTable = (targetModel as any).table;
        if (modelTable && config.fieldMappings) {
            for (const mapping of config.fieldMappings) {
                if (!(mapping.targetField in modelTable)) {
                    return errorResponse(
                        `Invalid target field '${mapping.targetField}' for model '${config.modelEntity}'`,
                        400,
                        { code: 'INVALID_FIELD' },
                    );
                }
            }
        }

        const content = await file.text();
        const parsed = parseFileContent(content, format);

        // Optionally save file to R2
        let r2Key: string | undefined;
        if (config.saveToR2 && context.env.OBCF_R2) {
            const timestamp = Date.now();
            r2Key = `ottaport/imports/${timestamp}-${sanitizeFilename(file.name)}`;
            await context.env.OBCF_R2.put(r2Key, content, {
                httpMetadata: { contentType: file.type || 'text/plain' },
                customMetadata: { originalName: sanitizeFilename(file.name), uploadedAt: new Date().toISOString() },
            });
        }

        // Execute import
        const result = await processImport(parsed.rows, config);

        // Log the job
        try {
            await PortJob.create({
                direction: 'import',
                modelEntity: config.modelEntity,
                status: result.status,
                format,
                filename: file.name,
                r2Key: r2Key || null,
                uniqueField: config.uniqueField,
                totalRows: result.totalRows,
                totalCreated: result.totalCreated,
                totalUpdated: result.totalUpdated,
                totalFailed: result.totalFailed,
                totalSkipped: result.totalSkipped,
                durationMs: result.durationMs,
                metadata: JSON.stringify({
                    fieldMappings: config.fieldMappings,
                    batchSize: config.batchSize,
                    errors: result.errors.slice(0, 100), // Limit stored errors
                }),
                userId: auth.user?.id || null,
                userEmail: auth.user?.email || null,
            });
        } catch {
            // Non-critical: job logging failure shouldn't break the import
        }

        // Log to audit
        try {
            await AuditLog.log({
                userId: auth.user?.id,
                userEmail: auth.user?.email,
                action: 'import',
                resourceType: config.modelEntity,
                status: result.status === 'completed' ? 'success' : 'failure',
                metadata: {
                    totalRows: result.totalRows,
                    totalCreated: result.totalCreated,
                    totalUpdated: result.totalUpdated,
                    totalFailed: result.totalFailed,
                    filename: file.name,
                    format,
                },
            });
        } catch {
            // Non-critical
        }

        return jsonResponse({ data: result });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Import failed';
        return errorResponse(message, 500, { code: 'IMPORT_ERROR' });
    }
}

// ============================================================
// POST /api/admin/ottaport/export — Export model data
// ============================================================
export async function handleOttaportExport(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    try {
        const body = (await context.request.json()) as ExportConfig;

        if (!body.modelEntity) {
            return errorResponse('modelEntity is required', 400, { code: 'MISSING_MODEL' });
        }

        const startTime = Date.now();
        const result = await processExport(body);

        // Log the export job
        try {
            await PortJob.create({
                direction: 'export',
                modelEntity: body.modelEntity,
                status: 'completed',
                format: body.format || 'csv',
                filename: result.filename,
                totalRows: result.totalRows,
                durationMs: Date.now() - startTime,
                metadata: JSON.stringify({
                    fields: body.fields,
                    where: body.where,
                    dateRange: body.dateRange,
                    search: body.search,
                }),
                userId: auth.user?.id || null,
                userEmail: auth.user?.email || null,
            });
        } catch {
            // Non-critical
        }

        // Log to audit
        try {
            await AuditLog.log({
                userId: auth.user?.id,
                userEmail: auth.user?.email,
                action: 'export',
                resourceType: body.modelEntity,
                status: 'success',
                metadata: {
                    totalRows: result.totalRows,
                    filename: result.filename,
                    format: body.format || 'csv',
                },
            });
        } catch {
            // Non-critical
        }

        // Return file as download
        return new Response(result.content, {
            status: 200,
            headers: {
                'Content-Type': result.contentType,
                'Content-Disposition': `attachment; filename="${sanitizeFilename(result.filename)}"`,
                ...context.corsHeaders,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Export failed';
        return errorResponse(message, 500, { code: 'EXPORT_ERROR' });
    }
}

// ============================================================
// GET /api/admin/ottaport/export/preview — Preview export data (paginated)
// ============================================================
export async function handleOttaportExportPreview(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    try {
        const url = context.url;
        const modelEntity = url.searchParams.get('model');
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const perPage = parseInt(url.searchParams.get('perPage') || '20', 10);
        const search = url.searchParams.get('search') || undefined;
        const orderBy = url.searchParams.get('orderBy') || undefined;
        const orderDirection = (url.searchParams.get('orderDirection') as 'asc' | 'desc') || undefined;

        if (!modelEntity) {
            return errorResponse('model parameter is required', 400, { code: 'MISSING_MODEL' });
        }

        const Model = getModel(modelEntity);
        if (!Model) {
            return errorResponse(`Model '${modelEntity}' not found`, 404, { code: 'MODEL_NOT_FOUND' });
        }

        // Build where from query params (key-value filter)
        const where: Record<string, unknown> = {};
        for (const [key, value] of url.searchParams.entries()) {
            if (['model', 'page', 'perPage', 'search', 'orderBy', 'orderDirection'].includes(key)) continue;
            if (key.startsWith('filter_')) {
                const fieldName = key.replace('filter_', '');
                where[fieldName] = value;
            }
        }

        let result;
        if (search) {
            result = await Model.searchPaginate(search, [], page, perPage, where, { orderBy, orderDirection });
        } else {
            result = await Model.paginate(page, perPage, where, { orderBy, orderDirection });
        }

        return jsonResponse({ data: result });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Preview failed';
        return errorResponse(message, 500, { code: 'PREVIEW_ERROR' });
    }
}

// ============================================================
// GET /api/admin/ottaport/jobs — List import/export job history
// ============================================================
export async function handleOttaportJobs(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    try {
        const url = context.url;
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const perPage = parseInt(url.searchParams.get('perPage') || '20', 10);
        const direction = url.searchParams.get('direction') || undefined;

        const where: Record<string, unknown> = {};
        if (direction) where.direction = direction;

        const result = await PortJob.paginate(page, perPage, where, {
            orderBy: 'createdAt',
            orderDirection: 'desc',
        });

        return jsonResponse({ data: result });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch jobs';
        return errorResponse(message, 500, { code: 'JOBS_ERROR' });
    }
}
