import { getSession } from '@ottabase/auth/backend';
import { createImagesClient } from '@ottabase/cf/images';
import { createR2Client } from '@ottabase/cf/r2';
import { createMediaLibraryRecordInput } from '@ottabase/medialibrary';
import type { MediaType, NewMediaType } from '@ottabase/ottaorm';
import { Media, globalRLS } from '@ottabase/ottaorm';
import { deleteFileFromR2 } from '@ottabase/ottaupload/server';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { buildMediaLibraryAccessFilter } from '../../ottabase/models/mediaLibraryPolicy';
import { getAuthOptions, getSecurityContext } from '../lib/auth-utils';
import { initDbConnection } from '../lib/db-utils';
import type { ApiRouteContext } from './router';

async function getResolvedMediaSecurityContext(request: Request, env: CloudflareEnv) {
    const session = await getSession(request, env as any, getAuthOptions(env));
    const config = getOttabaseConfig(env as Record<string, unknown>);
    const securityContext = await getSecurityContext(request, session, env);

    // Prefer explicit header, then configured appId, then the generic default.
    // config.appId takes precedence over securityContext.appId ('web') so that
    // uploads without the X-App-Id header still get the correct app identity.
    return {
        session,
        securityContext: {
            ...securityContext,
            appId: request.headers.get('x-app-id') || config.appId || securityContext.appId,
        },
    };
}

export async function persistUploadedMediaRecord(
    request: Request,
    env: CloudflareEnv,
    input: Partial<NewMediaType>,
    options?: {
        upsertByStorageKey?: boolean;
    },
): Promise<MediaType | null> {
    const { session, securityContext } = await getResolvedMediaSecurityContext(request, env);
    const userId = session?.user?.id;

    if (!userId) {
        return null;
    }

    initDbConnection(env);

    const createData = createMediaLibraryRecordInput({
        ...input,
        appId: input.appId ?? securityContext.appId ?? null,
        organizationId: input.organizationId ?? securityContext.organizationId ?? null,
        userId: input.userId ?? userId,
    });

    if (options?.upsertByStorageKey) {
        const accessFilter = buildMediaLibraryAccessFilter(securityContext);
        if (accessFilter) {
            const existingItems = await Media.where({
                ...accessFilter,
                storageKey: createData.storageKey,
            });
            const existingItem = existingItems[0] as Media | undefined;

            if (existingItem) {
                globalRLS.validateWrite(Media.entity, securityContext, createData as Record<string, unknown>, 'update');
                const updatedItem = await Media.update(
                    String(existingItem.get('id')),
                    createData as Record<string, unknown>,
                );
                return updatedItem.toJson() as MediaType;
            }
        }
    }

    globalRLS.validateWrite(Media.entity, securityContext, createData as Record<string, unknown>, 'create');
    const mediaItem = await Media.create(createData as Record<string, unknown>);

    return mediaItem.toJson() as MediaType;
}

async function deleteStoredMedia(env: CloudflareEnv, mediaItem: Media): Promise<void> {
    const provider = String(mediaItem.get('provider') || 'r2');
    const storageKey = String(mediaItem.get('storageKey') || '');

    if (!storageKey) {
        return;
    }

    if (provider === 'cloudflare-images') {
        const accountId = env.CLOUDFLARE_ACCOUNT_ID || env.CF_IMAGES_ACCOUNT_ID;
        const apiToken = env.CLOUDFLARE_API_TOKEN || env.CF_IMAGES_API_TOKEN;

        if (!accountId || !apiToken) {
            throw new Error('Cloudflare Images credentials not configured');
        }

        const imagesClient = createImagesClient({ accountId, apiToken });
        const result = await imagesClient.delete(storageKey);
        if (!result.success) {
            throw result.error;
        }
        return;
    }

    if (!env.OBCF_R2) {
        throw new Error('R2 bucket binding not configured');
    }

    const r2Client = createR2Client({ bucket: env.OBCF_R2 });
    const result = await deleteFileFromR2(storageKey, r2Client);
    if (!result.success) {
        throw new Error(result.error || 'Failed to delete media file');
    }
}

export async function handleMediaLibraryPurge(context: ApiRouteContext, mediaId: string): Promise<Response> {
    const { request, env } = context;

    const { session, securityContext } = await getResolvedMediaSecurityContext(request, env);
    if (!session?.user?.id) {
        return errorResponse('Unauthorized', 401, {
            code: 'UNAUTHORIZED',
        });
    }

    initDbConnection(env);

    const accessFilter = buildMediaLibraryAccessFilter(securityContext);
    if (!accessFilter) {
        return errorResponse('Forbidden', 403, {
            code: 'FORBIDDEN',
        });
    }

    const matches = await Media.where({
        ...accessFilter,
        id: mediaId,
    });
    const mediaItem = matches[0] as Media | undefined;

    if (!mediaItem) {
        return errorResponse('Media item not found', 404, {
            code: 'NOT_FOUND',
        });
    }

    try {
        globalRLS.validateWrite(Media.entity, securityContext, mediaItem.toJson() as Record<string, unknown>, 'delete');
        await deleteStoredMedia(env, mediaItem);
        await Media.delete(mediaId);

        return jsonResponse({
            success: true,
            data: { id: mediaId },
            message: 'Media deleted successfully',
        });
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Failed to delete media', 500, {
            code: 'MEDIA_DELETE_FAILED',
        });
    }
}
