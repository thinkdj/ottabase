import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { Shortlink, buildRedirectResponse } from '@ottabase/shortlinks';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { paginatedJsonResponse, parsePaginationParams } from '@ottabase/utils/pagination';
import type { CloudflareEnv } from '../../cloudflare-env';
import { readJson } from '../lib/utils';

export interface ShortlinkContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

export async function handleShortlinksList(context: ShortlinkContext): Promise<Response> {
    const { env, url } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const { page, perPage, orderBy, order } = parsePaginationParams(url.searchParams);
    const appId = url.searchParams.get('appId');
    const type = url.searchParams.get('type');
    const where: Record<string, unknown> = {};
    if (appId) where.appId = appId;
    if (type) where.type = type;

    const paginationResult = await Shortlink.paginate(
        page,
        perPage,
        Object.keys(where).length > 0 ? where : undefined,
        { orderBy, orderDirection: order },
    );

    return paginatedJsonResponse({
        data: paginationResult.data.map((s) => s.toJson()),
        total: paginationResult.total,
        page: paginationResult.page,
        perPage: paginationResult.perPage,
        path: '/api/shortlinks',
    });
}

export async function handleShortlinksCreate(context: ShortlinkContext): Promise<Response> {
    const { env, request } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<{
        fullUrl?: string;
        shortCode?: string;
        type?: string;
        appId?: string;
        expiryDate?: string | null;
    }>(request);

    if (!body.fullUrl || !body.shortCode) {
        return errorResponse('fullUrl and shortCode are required', 400);
    }

    const existing = await Shortlink.findByCode(body.shortCode);
    if (existing) {
        return errorResponse('Short code already exists', 409, {
            code: 'DUPLICATE_SHORT_CODE',
        });
    }

    try {
        const expiryDate = body.expiryDate ? new Date(body.expiryDate).getTime() : null;
        const shortlink = await Shortlink.create({
            fullUrl: body.fullUrl,
            shortCode: body.shortCode,
            type: body.type || 'redirect',
            appId: body.appId || 'default',
            expiryDate: Number.isNaN(expiryDate) ? null : expiryDate,
        });

        return jsonResponse({
            success: true,
            data: shortlink.toJson(),
        });
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Failed to create shortlink', 400, {
            code: 'VALIDATION_ERROR',
        });
    }
}

export async function handleShortlinkById(
    context: ShortlinkContext,
    id: string,
    method: 'PATCH' | 'DELETE',
): Promise<Response> {
    const { env, request } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    if (method === 'PATCH') {
        const body = await readJson<{
            fullUrl?: string;
            shortCode?: string;
            type?: string;
            expiryDate?: string | null;
        }>(request);

        const shortlink = await Shortlink.find(id);
        if (!shortlink) {
            return errorResponse('Shortlink not found', 404);
        }

        if (body.shortCode && body.shortCode !== shortlink.get('shortCode')) {
            const existing = await Shortlink.findByCode(body.shortCode);
            if (existing) {
                return errorResponse('Short code already exists', 409, {
                    code: 'DUPLICATE_SHORT_CODE',
                });
            }
            shortlink.set('shortCode', body.shortCode);
        }

        if (body.fullUrl) shortlink.set('fullUrl', body.fullUrl);
        if (body.type) shortlink.set('type', body.type);
        if (body.expiryDate !== undefined) {
            const expiryDate = body.expiryDate ? new Date(body.expiryDate).getTime() : null;
            shortlink.set('expiryDate', Number.isNaN(expiryDate) ? null : expiryDate);
        }

        try {
            await shortlink.save();
            return jsonResponse({
                success: true,
                data: shortlink.toJson(),
            });
        } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Failed to update shortlink', 400, {
                code: 'VALIDATION_ERROR',
            });
        }
    }

    const shortlink = await Shortlink.find(id);
    if (!shortlink) {
        return errorResponse('Shortlink not found', 404);
    }

    await Shortlink.delete(id);
    return jsonResponse({
        success: true,
        message: 'Shortlink deleted successfully',
    });
}

export async function handleShortlinkExplicitGo(context: ShortlinkContext): Promise<Response> {
    const { request, env, url } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    const code = url.searchParams.get('code') || url.searchParams.get('s') || url.searchParams.get('id');
    if (!code) {
        return errorResponse('Missing shortlink code', 400, {
            hint: 'Use /shortlinks/go?code=... or ?s=...',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    try {
        const shortlink = await Shortlink.findByCode(code);

        if (!shortlink) {
            return errorResponse('Shortlink not found', 404, {
                code: 'LINK_NOT_FOUND',
            });
        }

        shortlink.trackClick().catch((err) => {
            console.error('Failed to track shortlink click:', err);
        });

        return buildRedirectResponse(shortlink);
    } catch (error) {
        console.error('Shortlink explicit redirect error:', error);
        return errorResponse('Failed to process shortlink', 500);
    }
}

export async function handleShortlinkFallback(context: ShortlinkContext): Promise<Response | null> {
    const { env, request, url } = context;
    if (
        !env.OBCF_D1 ||
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/@') ||
        url.pathname === '/' ||
        /\.[a-zA-Z0-9]+$/.test(url.pathname)
    ) {
        return null;
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const shortCode = url.pathname.substring(1);
    const shortlink = await Shortlink.findByCode(shortCode);
    if (!shortlink) {
        return null;
    }

    shortlink.trackClick().catch((error) => {
        console.error('Shortlink click tracking error:', error);
    });

    return buildRedirectResponse(shortlink);
}
