// ============================================================
// /api/users/me/avatar — the signed-in user's uploaded avatar
// ============================================================
// PUT stores the image through the files service (purpose `avatar`: public, raster only,
// metadata stripped, a 160 px thumb when the Images binding is bound) and points
// `users.avatarKey` at what the UI shows: the thumb's key when one was made, else the
// original's. The previous avatar is deleted: a key is never overwritten, so a replacement
// is always a new file and a delete. DELETE drops the avatar; the OAuth provider's picture
// (`users.image`), if any, shows again.
//
// Both bump the profile version, so every live session picks up the new `image` on its
// next request (see AGENTS.MD, "making a mutated user field reflect everywhere").
// ============================================================

import { User } from '@ottabase/ottaorm';
import { FilesError } from '@ottabase/ottaupload/server';
import { fileIdFromKey } from '@ottabase/utils/media';
import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { files } from '../../ottabase/files';
import { bumpProfileVersion } from '../lib/auth-utils';
import { initDbConnection } from '../lib/db-utils';
import { enforceUploadRateLimit } from '../lib/rate-limiting';
import { fileViewer } from './files';
import type { ApiRouteContext } from './router';

/** Delete the file behind a previous `avatarKey`. Best effort: a leftover file must not fail the change. */
async function removeAvatarFile(env: CloudflareEnv, key: unknown): Promise<void> {
    const id = typeof key === 'string' ? fileIdFromKey(key) : null;
    if (!id) return;
    await files.remove(env, id).catch((error) => {
        console.warn(JSON.stringify({ event: 'avatar_remove_failed', error: redactErrorForLog(error) }));
    });
}

/** PUT /api/users/me/avatar — multipart `file`. Answers `{ image }`, the URL every view now shows. */
export async function handleAvatarUpload(context: ApiRouteContext): Promise<Response> {
    const { request, env } = context;
    const viewer = await fileViewer(request, env);
    if (!viewer) return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    const limited = await enforceUploadRateLimit(request, env, viewer.userId);
    if (limited) return limited;

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) return errorResponse('file is required', 400, { code: 'BAD_REQUEST' });

    initDbConnection(env);
    const user = await User.find(viewer.userId);
    if (!user) return errorResponse('User not found', 404, { code: 'NOT_FOUND' });

    try {
        // The avatar is the person's, not their organization's: it follows them between orgs.
        const view = await files.put(env, {
            purpose: 'avatar',
            owner: { appId: getOttabaseConfig(env).appId, userId: viewer.userId, organizationId: null },
            file,
        });
        const previous = user.get('avatarKey');
        const updated = await User.update(viewer.userId, { avatarKey: view.variants?.thumb?.key ?? view.storageKey });
        await removeAvatarFile(env, previous);
        await bumpProfileVersion(env, viewer.userId);
        return jsonResponse({ success: true, image: User.imageUrl(updated.toJson()) });
    } catch (error) {
        if (error instanceof FilesError) return errorResponse(error.message, error.status, { code: error.code });
        throw error;
    }
}

/** DELETE /api/users/me/avatar */
export async function handleAvatarRemove(context: ApiRouteContext): Promise<Response> {
    const { request, env } = context;
    const viewer = await fileViewer(request, env);
    if (!viewer) return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    initDbConnection(env);
    const user = await User.find(viewer.userId);
    if (!user) return errorResponse('User not found', 404, { code: 'NOT_FOUND' });
    const previous = user.get('avatarKey');
    if (!previous) return jsonResponse({ success: true, image: User.imageUrl(user.toJson()) });
    const updated = await User.update(viewer.userId, { avatarKey: null });
    await removeAvatarFile(env, previous);
    await bumpProfileVersion(env, viewer.userId);
    return jsonResponse({ success: true, image: User.imageUrl(updated.toJson()) });
}
