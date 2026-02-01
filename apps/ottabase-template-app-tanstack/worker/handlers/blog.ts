/**
 * Blog CMS - Studio API for themes and plugins management
 */

import { OttablogPlugin, OttablogTheme, StudioManager } from '@ottabase/ottablog';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { readJson } from '../utils/request';

export async function handleBlogStudio(request: Request, url: URL, env: CloudflareEnv): Promise<Response | null> {
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    const appId: string | null = null; // could come from session later

    // GET /api/blog/studio/state
    if (url.pathname === '/api/blog/studio/state' && request.method === 'GET') {
        const state = await StudioManager.getState(appId);
        // Seed default theme and plugin if none exist
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

    // POST /api/blog/studio/theme/activate
    if (url.pathname === '/api/blog/studio/theme/activate' && request.method === 'POST') {
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

    // POST /api/blog/studio/plugin/enable
    if (url.pathname === '/api/blog/studio/plugin/enable' && request.method === 'POST') {
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

    // POST /api/blog/studio/plugin/config
    if (url.pathname === '/api/blog/studio/plugin/config' && request.method === 'POST') {
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

    return null;
}
