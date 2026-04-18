import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { parsePaginationParams } from '@ottabase/utils/pagination';
import { requireAdminAccess } from '../lib/admin-guard';
import type { ApiRouteContext } from './router';

export type AdminDbContext = ApiRouteContext & { tableName?: string };

export async function handleAdminDbTables(context: AdminDbContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500);
    }

    try {
        const result = await env.OBCF_D1.prepare(
            `SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name`,
        ).all();

        return jsonResponse({
            tables: result.results.map((r: any) => r.name),
        });
    } catch (e) {
        return errorResponse(e instanceof Error ? e.message : 'Failed to list tables', 500);
    }
}

export async function handleAdminDbTableData(context: AdminDbContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env, url, tableName } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500);
    }
    const name = tableName || '';

    const { page = 1, perPage = 25 } = parsePaginationParams(url.searchParams);
    const offset = (page - 1) * perPage;

    try {
        const columnsResult = await env.OBCF_D1.prepare(`PRAGMA table_info("${name}")`).all();
        const columns = columnsResult.results;

        const countResult = await env.OBCF_D1.prepare(`SELECT count(*) as total FROM "${name}"`).first();
        const total = (countResult as any)?.total || 0;

        const rowsResult = await env.OBCF_D1.prepare(`SELECT * FROM "${name}" LIMIT ? OFFSET ?`)
            .bind(perPage, offset)
            .all();

        return jsonResponse({
            tableName: name,
            columns,
            rows: rowsResult.results,
            pagination: {
                page,
                perPage,
                total,
                totalPages: Math.ceil(total / perPage),
            },
        });
    } catch (e) {
        return errorResponse(e instanceof Error ? e.message : 'Failed to fetch table data', 500);
    }
}

export async function handleAdminDbTableDelete(context: AdminDbContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env, tableName } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500);
    }
    const name = tableName || '';

    try {
        const tableExists = await env.OBCF_D1.prepare(`SELECT name FROM sqlite_schema WHERE type='table' AND name = ?`)
            .bind(name)
            .first();

        if (!tableExists) {
            return errorResponse('Table not found', 404);
        }

        await env.OBCF_D1.prepare(`DROP TABLE "${name}"`).run();

        return jsonResponse({
            success: true,
            message: `Table ${name} dropped successfully`,
        });
    } catch (e) {
        return errorResponse(e instanceof Error ? e.message : 'Failed to drop table', 500);
    }
}

export async function handleAdminDbRowDelete(
    context: AdminDbContext,
    rowId: string,
    pkField: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env, tableName } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500);
    }
    const name = tableName || '';

    try {
        const tableExists = await env.OBCF_D1.prepare(`SELECT name FROM sqlite_schema WHERE type='table' AND name = ?`)
            .bind(name)
            .first();

        if (!tableExists) {
            return errorResponse('Table not found', 404);
        }

        const query = `DELETE FROM "${name}" WHERE "${pkField}" = ?`;
        await env.OBCF_D1.prepare(query).bind(rowId).run();

        return jsonResponse({
            success: true,
            message: `Deleted row where ${pkField} = ${rowId}`,
        });
    } catch (e) {
        return errorResponse(e instanceof Error ? e.message : 'Failed to delete row', 500);
    }
}
