// ====================================================================
// GET /api/admin/ai/config — platform-admin OttaAI / AI Gateway snapshot
// --------------------------------------------------------------------
// Read-only. Secrets are present/absent only. Org admins use
// /admin/growth/ai-providers (BYOK); this is the control-plane view.
// ====================================================================

import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminAccess } from '../lib/admin-guard';
import { getAiConfigSnapshot } from '../lib/ai-config';
import type { ApiRouteContext } from './router';

export async function handleAdminAiConfig(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    try {
        return jsonResponse(getAiConfigSnapshot(context.env), 200, {
            headers: { 'Cache-Control': 'private, no-store' },
        });
    } catch (error) {
        console.error(JSON.stringify({ event: 'admin.ai.config', ...redactErrorForLog(error) }));
        return errorResponse('Failed to load AI configuration', 500, { code: 'CONFIG_ERROR' });
    }
}
