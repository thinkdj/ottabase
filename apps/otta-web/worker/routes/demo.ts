import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { readJson } from '../lib/utils';
import type { CloudflareEnv } from '../../cloudflare-env';

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
