import { getSession } from '@ottabase/auth/backend';
import { createImagesClient } from '@ottabase/cf/images';
import { createKVClient } from '@ottabase/cf/kv';
import { createR2Client } from '@ottabase/cf/r2';
import { uploadFileToCloudflareImages, uploadFileToR2 } from '@ottabase/ottaupload/server';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getAuthOptions } from '../lib/auth-utils';
import { persistUploadedMediaRecord } from './media-library';

export interface StorageRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

/** Deterministic hash of userId for avatar path obfuscation (SHA-256, 32 hex chars) */
async function hashUserId(userId: string): Promise<string> {
    const data = new TextEncoder().encode(userId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 32);
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
    const envConfig = env as Record<string, string | undefined>;
    if (request.method !== 'POST') {
        return errorResponse('Method not allowed', 405, {
            code: 'METHOD_NOT_ALLOWED',
        });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const provider = (formData.get('provider') as string) || 'r2';
        const session = await getSession(request, env as any, getAuthOptions(env));
        const customKey = formData.get('key') as string | null;

        if (!(file instanceof File)) {
            return errorResponse('file is required', 400);
        }

        // All uploads require an authenticated session to prevent orphan R2 objects and abuse
        if (!session?.user?.id) {
            return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
        }

        if (provider === 'cloudflare-images') {
            const accountId = envConfig.CLOUDFLARE_ACCOUNT_ID as string;
            const apiToken = envConfig.CLOUDFLARE_API_TOKEN as string;

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
                const media = await persistUploadedMediaRecord(request, env, {
                    provider: 'cloudflare-images',
                    storageKey: result.key || '',
                    url: result.url || '',
                    fileName: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    fileSize: file.size,
                });

                return jsonResponse({
                    success: true,
                    url: result.url,
                    key: result.key,
                    provider: 'cloudflare-images',
                    media,
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

        // Avatar upload: use fixed key {userId}/avatar.png so each upload overwrites
        let uploadOptions: { maxFileSize: number; generateKey?: (file: File) => string } = {
            maxFileSize: 50 * 1024 * 1024,
        };

        if (customKey === 'avatar') {
            const userId = session?.user?.id;
            if (!userId) {
                return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
            }
            const hash = await hashUserId(userId);
            uploadOptions.generateKey = () => `${hash}/avatar.png`;
        }

        const r2Client = createR2Client({ bucket: env.OBCF_R2 as any });
        const result = await uploadFileToR2(file, r2Client, uploadOptions);

        if (result.success) {
            // Avatar: append ?v=timestamp for cache busting when user uploads new image
            const url = customKey === 'avatar' ? `${result.url || ''}?v=${Date.now()}` : result.url || '';
            const media = await persistUploadedMediaRecord(
                request,
                env,
                {
                    provider: 'r2',
                    storageKey: result.key || '',
                    url,
                    fileName: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    fileSize: file.size,
                },
                {
                    upsertByStorageKey: customKey === 'avatar',
                },
            );

            return jsonResponse({
                success: true,
                url,
                key: result.key,
                provider: 'r2',
                media,
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
    const envConfig = env as Record<string, string | undefined>;
    const accountId = envConfig.CF_IMAGES_ACCOUNT_ID;
    const apiToken = envConfig.CF_IMAGES_API_TOKEN;

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
