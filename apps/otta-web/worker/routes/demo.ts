import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { isDemoMode, readJson } from '../lib/utils';

export interface DemoRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

export async function handleDemo(context: DemoRouteContext): Promise<Response> {
    const { request } = context;

    if (request.method === 'GET') {
        return jsonResponse({
            message: 'Hello from GET',
            method: 'GET',
            timestamp: Date.now(),
        });
    }

    if (request.method === 'POST') {
        const body = await readJson<{ name?: string }>(request);
        return jsonResponse({
            message: `Hello, ${body.name || 'World'}!`,
            method: 'POST',
            timestamp: Date.now(),
        });
    }

    if (request.method === 'DELETE') {
        return jsonResponse({
            message: 'Resource deleted',
            method: 'DELETE',
            timestamp: Date.now(),
        });
    }

    return errorResponse('Method not allowed', 405, {
        code: 'METHOD_NOT_ALLOWED',
    });
}

/**
 * Public: whether this deploy is a public demo, and the banner's call to action
 * (`DEMO_CTA_LABEL` / `DEMO_CTA_URL`, both optional). Read once per visit by `useDemoMode()`.
 */
export function handleDemoMode(context: DemoRouteContext): Response {
    const { env } = context;
    if (!isDemoMode(env)) return jsonResponse({ enabled: false, ctaLabel: null, ctaUrl: null });
    return jsonResponse({
        enabled: true,
        ctaLabel: env.DEMO_CTA_LABEL?.trim() || null,
        ctaUrl: env.DEMO_CTA_URL?.trim() || null,
    });
}

export function handleDemoError(): Response {
    return errorResponse('Something went wrong', 500, {
        code: 'DEMO_ERROR',
        hint: 'This is a demo error response with multiple messages',
        messages: [
            'Primary error: Database connection failed',
            'Secondary issue: Authentication token expired',
            'Additional context: Rate limit may have been exceeded',
        ],
    });
}
