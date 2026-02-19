import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { verifyPassword } from '@ottabase/auth/backend';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { readJson } from '../lib/utils';
import { OttablogPlugin, OttablogTheme, StudioManager, Post } from '@ottabase/ottablog';
import type { CloudflareEnv } from '../../cloudflare-env';

export interface BlogRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

function ensureD1(env: CloudflareEnv): Response | null {
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }
    return null;
}

function publicPostJson(record: Post, options?: { includeContent?: boolean }) {
    const j = record.toJson() as Record<string, unknown>;
    const { privateNotes, ...rest } = j;
    if (rest.isProtected && !options?.includeContent) {
        const { content, footnotes, ...restNoContent } = rest;
        return { ...restNoContent, content: null, footnotes: null };
    }
    return rest;
}

export async function handleBlogStudioState(context: BlogRouteContext): Promise<Response> {
    const { request, env } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId: string | null = null;
    const state = await StudioManager.getState(appId);

    if (state.themes.length === 0) {
        await OttablogTheme.create({
            themeId: 'default',
            name: 'Default',
            description: 'Clean, modern default theme',
            appId,
            isActive: true,
        });
    }
    if (state.plugins.length === 0) {
        await OttablogPlugin.create({
            pluginId: 'content-injector-plugin',
            name: 'Content Injector Plugin',
            description: 'Injects custom content into posts',
            appId,
            enabled: false,
        });
    }

    const finalState = await StudioManager.getState(appId);
    return jsonResponse(finalState);
}

export async function handleBlogStudioActivateTheme(context: BlogRouteContext): Promise<Response> {
    const { request, env } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId: string | null = null;
    const body = await readJson<{ themeId: string }>(request);
    const themeId = body?.themeId;
    if (!themeId) {
        return errorResponse('themeId is required', 400, { code: 'VALIDATION_ERROR' });
    }

    let themeRow = await OttablogTheme.findByThemeId(themeId, { appId: appId ?? undefined });
    if (!themeRow) {
        await OttablogTheme.create({
            themeId,
            name: themeId,
            appId,
            isActive: false,
        });
        themeRow = await OttablogTheme.findByThemeId(themeId, { appId: appId ?? undefined });
    }
    if (themeRow) {
        await themeRow.activate({ appId: appId ?? undefined });
    }
    return jsonResponse({ success: true });
}

export async function handleBlogStudioPluginEnable(context: BlogRouteContext): Promise<Response> {
    const { request, env } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId: string | null = null;
    const body = await readJson<{ pluginId: string; enabled: boolean }>(request);
    const pluginId = body?.pluginId;
    const enabled = body?.enabled ?? true;

    if (!pluginId) {
        return errorResponse('pluginId is required', 400, { code: 'VALIDATION_ERROR' });
    }

    let pluginRow = await OttablogPlugin.findByPluginId(pluginId, { appId: appId ?? undefined });
    if (!pluginRow) {
        await OttablogPlugin.create({
            pluginId,
            name: pluginId,
            appId,
            enabled,
        });
    } else {
        pluginRow.set('enabled', enabled);
        await pluginRow.save();
    }
    return jsonResponse({ success: true });
}

export async function handleBlogStudioPluginConfig(context: BlogRouteContext): Promise<Response> {
    const { request, env } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId: string | null = null;
    const body = await readJson<{ pluginId: string; config: Record<string, unknown> }>(request);
    const pluginId = body?.pluginId;
    const config = body?.config;

    if (!pluginId) {
        return errorResponse('pluginId is required', 400, { code: 'VALIDATION_ERROR' });
    }

    const pluginRow = await OttablogPlugin.findByPluginId(pluginId, { appId: appId ?? undefined });
    if (!pluginRow) {
        return errorResponse('Plugin not found', 404, { code: 'NOT_FOUND' });
    }

    await pluginRow.updateConfig(config ?? {});
    return jsonResponse({ success: true });
}

export async function handleBlogPostsList(context: BlogRouteContext): Promise<Response> {
    const { env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get('perPage') || '15', 10)));
    const appId = url.searchParams.get('appId') || null;
    const contentType = url.searchParams.get('contentType') || null;
    const seriesId = url.searchParams.get('seriesId') || null;
    const where: Record<string, unknown> = { status: 'published' };
    if (appId) where.appId = appId;
    if (contentType) where.contentType = contentType;
    if (seriesId) where.seriesId = seriesId;

    const result = await Post.paginate(page, perPage, where, {
        orderBy: 'publishedAt',
        orderDirection: 'desc',
    });
    const data = result.data.map((r) => publicPostJson(r));
    return jsonResponse({
        data,
        pagination: {
            page: result.page,
            perPage: result.perPage,
            total: result.total,
            totalPages: result.totalPages,
        },
    });
}

export async function handleBlogPostBySlug(context: BlogRouteContext, slug: string): Promise<Response> {
    const { env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId = url.searchParams.get('appId') || null;
    const where: Record<string, unknown> = { slug, status: 'published' };
    if (appId) where.appId = appId;
    const record = await Post.first(where);
    if (!record) {
        return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
    }
    return jsonResponse(publicPostJson(record));
}

export async function handleBlogPostUnlock(context: BlogRouteContext): Promise<Response> {
    const { request, env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<{ slug: string; password: string }>(request);
    const slug = body?.slug?.trim();
    const password = body?.password;

    if (!slug || password === undefined || password === null) {
        return errorResponse('slug and password are required', 400, { code: 'VALIDATION_ERROR' });
    }

    const appId = url.searchParams.get('appId') || null;
    const where: Record<string, unknown> = { slug, status: 'published' };
    if (appId) where.appId = appId;
    const record = await Post.first(where);
    if (!record) {
        return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
    }

    const isProtected = record.get('isProtected');
    const passwordHash = record.get('passwordHash');
    if (!isProtected || !passwordHash) {
        return jsonResponse(publicPostJson(record, { includeContent: true }));
    }

    const valid = await verifyPassword(String(password), String(passwordHash));
    if (!valid) {
        return errorResponse('Invalid password', 401, { code: 'INVALID_PASSWORD' });
    }

    return jsonResponse(publicPostJson(record, { includeContent: true }));
}
