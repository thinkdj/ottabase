import { createKVClient } from '@ottabase/cf/kv';
import { createR2Client } from '@ottabase/cf/r2';
import { createImagesClient } from '@ottabase/cf/images';
import { uploadFileToCloudflareImages, uploadFileToR2 } from '@ottabase/ottaupload/server';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';

export interface StorageRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

export async function handleCloudflareKV(context: StorageRouteContext): Promise<Response> {
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

export async function handleCloudflareR2(context: StorageRouteContext): Promise<Response> {
    const { request, env, url } = context;
    if (!env.OBCF_R2) {
        return errorResponse('R2 bucket binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    if (request.method === 'GET') {
        if (url.searchParams.get('list') === 'true') {
            const listing = await env.OBCF_R2.list({ limit: 100 });
            return jsonResponse({ objects: listing.objects });
        }

        const key = url.searchParams.get('key');
        if (!key) return errorResponse('key is required', 400);

        const object = await env.OBCF_R2.get(key);
        if (!object) return errorResponse('Object not found', 404);

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Content-Disposition', `attachment; filename="${key}"`);

        return new Response(object.body, { headers });
    }

    if (request.method === 'POST') {
        const formData = await request.formData();
        const file = formData.get('file');
        const key = formData.get('key');

        if (!key || typeof key !== 'string') {
            return errorResponse('key is required', 400);
        }
        if (!(file instanceof File)) {
            return errorResponse('file is required', 400);
        }

        await env.OBCF_R2.put(key, await file.arrayBuffer(), {
            httpMetadata: {
                contentType: file.type || 'application/octet-stream',
            },
        });

        const publicUrl = `/api/cloudflare/r2?key=${encodeURIComponent(key)}`;
        return jsonResponse({ success: true, data: { url: publicUrl } });
    }

    if (request.method === 'DELETE') {
        const key = url.searchParams.get('key');
        if (!key) return errorResponse('key is required', 400);
        await env.OBCF_R2.delete(key);
        return jsonResponse({ success: true });
    }

    return errorResponse('Method not allowed', 405, {
        code: 'METHOD_NOT_ALLOWED',
    });
}

export async function handleUpload(context: StorageRouteContext): Promise<Response> {
    const { request, env } = context;
    if (request.method !== 'POST') {
        return errorResponse('Method not allowed', 405, {
            code: 'METHOD_NOT_ALLOWED',
        });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const provider = (formData.get('provider') as string) || 'r2';

        if (!(file instanceof File)) {
            return errorResponse('file is required', 400);
        }

        if (provider === 'cloudflare-images') {
            const accountId = env.CLOUDFLARE_ACCOUNT_ID as string;
            const apiToken = env.CLOUDFLARE_API_TOKEN as string;

            if (!accountId || !apiToken) {
                return errorResponse(
                    'Cloudflare Images not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN',
                    500,
                    { code: 'CONFIG_ERROR' },
                );
            }

            const result = await uploadFileToCloudflareImages(
                file,
                {
                    accountId,
                    apiToken,
                },
                {
                    maxFileSize: 10 * 1024 * 1024,
                },
            );

            if (result.success) {
                return jsonResponse({
                    success: true,
                    url: result.url,
                    key: result.key,
                    provider: 'cloudflare-images',
                });
            }

            const errorCode = (result as any).code;
            const status = errorCode === 'CONFIG_ERROR' ? 500 : 400;
            return errorResponse(result.error || 'Upload failed', status, errorCode ? { code: errorCode } : undefined);
        }

        if (!env.OBCF_R2) {
            return errorResponse('R2 bucket binding not configured', 500, {
                code: 'CONFIG_ERROR',
            });
        }

        const r2Client = createR2Client({ bucket: env.OBCF_R2 });
        const result = await uploadFileToR2(file, r2Client, {
            maxFileSize: 50 * 1024 * 1024,
        });

        if (result.success) {
            return jsonResponse({
                success: true,
                url: result.url,
                key: result.key,
                provider: 'r2',
            });
        }

        return errorResponse(result.error || 'Upload failed', 400);
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Upload failed', 500);
    }
}

export async function handleUploadFile(context: StorageRouteContext): Promise<Response> {
    const { env, url } = context;
    if (!env.OBCF_R2) {
        return errorResponse('R2 bucket binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    const key = url.pathname.replace('/api/upload/file/', '');
    if (!key) {
        return errorResponse('key is required', 400);
    }

    const object = await env.OBCF_R2.get(key);
    if (!object) {
        return errorResponse('File not found', 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    return new Response(object.body, { headers });
}

export async function handleCloudflareImages(context: StorageRouteContext): Promise<Response> {
    const { env, request } = context;
    const accountId = env.CF_IMAGES_ACCOUNT_ID;
    const apiToken = env.CF_IMAGES_API_TOKEN;

    if (!accountId || !apiToken) {
        return errorResponse('Cloudflare Images credentials not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    const imagesClient = createImagesClient({ accountId, apiToken });

    if (request.method !== 'POST') {
        return errorResponse('Method not allowed', 405, {
            code: 'METHOD_NOT_ALLOWED',
        });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
        return errorResponse('file is required', 400);
    }

    const result = await imagesClient.upload(file);

    if (!result.success) {
        return errorResponse(result.error.message, 500);
    }

    const variants = result.data.variants;
    const publicUrl = variants && variants.length > 0 ? variants[0] : null;

    return jsonResponse({
        success: true,
        data: {
            url: publicUrl,
            variants,
            id: result.data.id,
        },
    });
}
