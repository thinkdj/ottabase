// /api/cloudflare/kv and /api/cloudflare/r2: system-admin demos of the raw KV and R2 bindings.
// User files never come through here: they go through the files service (routes/files.ts).

import { createKVClient } from '@ottabase/cf/kv';
import { applySafeObjectHeaders } from '@ottabase/ottaupload/server';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminAccess } from '../lib/admin-guard';
import type { ApiRouteContext } from './router';

/** The R2 demo reads and writes only under this prefix of the private bucket. */
const DEMO_PREFIX = 'demo/';

export async function handleCloudflareKV(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { request, env, url } = context;
    if (!env.OBCF_KV) {
        return errorResponse('KV namespace binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    const kv = createKVClient({ namespace: env.OBCF_KV as any });

    if (request.method === 'GET') {
        const key = url.searchParams.get('key');
        if (!key) return errorResponse('Key is required', 400);

        const result = await kv.getText(key);
        if (!result.success) {
            return errorResponse('Failed to get value', 500, {
                details: result.error.message,
            });
        }

        return jsonResponse({ value: result.data });
    }

    if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const key = (body as any).key;
        const value = (body as any).value;
        const ttl = (body as any).ttl;
        if (!key || !value) {
            return errorResponse('Key and value are required', 400);
        }

        const expirationTtl = ttl ? parseInt(String(ttl), 10) : undefined;
        const result = await kv.put(key, value, { expirationTtl });
        if (!result.success) {
            return errorResponse('Failed to set value', 500, {
                details: result.error.message,
            });
        }
        return jsonResponse({ success: true });
    }

    if (request.method === 'DELETE') {
        const key = url.searchParams.get('key');
        if (!key) return errorResponse('Key is required', 400);

        const result = await kv.delete(key);
        if (!result.success) {
            return errorResponse('Failed to delete value', 500, {
                details: result.error.message,
            });
        }
        return jsonResponse({ success: true });
    }

    return errorResponse('Method not allowed', 405, {
        code: 'METHOD_NOT_ALLOWED',
    });
}

export async function handleCloudflareR2(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { request, env, url } = context;
    // The PRIVATE bucket: raw keys written here are never served by key to anyone but this
    // system-admin route, so the public bucket keeps holding only files the files service wrote.
    const bucket = env.OBCF_R2_PRIVATE;
    if (!bucket) {
        return errorResponse('R2 bucket binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    if (request.method === 'GET') {
        if (url.searchParams.get('list') === 'true') {
            const listing = await bucket.list({ prefix: DEMO_PREFIX, limit: 100 });
            return jsonResponse({ objects: listing.objects });
        }

        const key = url.searchParams.get('key');
        if (!key) return errorResponse('key is required', 400);

        const object = key.startsWith(DEMO_PREFIX) ? await bucket.get(key) : null;
        if (!object) return errorResponse('Object not found', 404);
        const headers = new Headers();
        object.writeHttpMetadata(headers as never);
        applySafeObjectHeaders(headers, key);
        return new Response(object.body as BodyInit, { headers });
    }

    if (request.method === 'POST') {
        const formData = await request.formData();
        const file = formData.get('file');
        const key = formData.get('key');

        if (!key || typeof key !== 'string' || !key.startsWith(DEMO_PREFIX)) {
            return errorResponse(`key is required and must start with ${DEMO_PREFIX}`, 400);
        }
        if (!(file instanceof File)) {
            return errorResponse('file is required', 400);
        }

        await bucket.put(key, await file.arrayBuffer(), {
            httpMetadata: {
                contentType: file.type || 'application/octet-stream',
            },
        });

        const publicUrl = `/api/cloudflare/r2?key=${encodeURIComponent(key)}`;
        return jsonResponse({ success: true, data: { url: publicUrl } });
    }

    if (request.method === 'DELETE') {
        const key = url.searchParams.get('key');
        if (!key || !key.startsWith(DEMO_PREFIX)) return errorResponse('key is required', 400);
        await bucket.delete(key);
        return jsonResponse({ success: true });
    }

    return errorResponse('Method not allowed', 405, {
        code: 'METHOD_NOT_ALLOWED',
    });
}
