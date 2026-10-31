// ============================================================
// /api/files — the files service over HTTP
// ============================================================
// The routes are thin: who is asking (a verified session, never a header), which file, and
// the service (`ottabase/files.ts`) does the rest. Ownership columns come from the session:
// the app from server config, the organization from the session's validated active org.
//
//   POST   /api/files                   multipart `file`, `purpose`, optional `title`, `altText`
//   GET    /api/files/public/<key>      the public bucket by key (ETag/304, Range, immutable)
//   GET    /api/files/:id[/:variant]    public: 302 to its URL; private: the bytes, if allowed
//                                       (same org for `members`, uploader or admin for `owner`,
//                                       or a signed `?t=` token)
//   PATCH  /api/files/:id               { title, altText, caption }
//   DELETE /api/files/:id               the file, its variants and its row
//   POST   /api/files/:id/quarantine    admins: stop serving it (out of the public bucket, purged)
//   DELETE /api/files/:id/quarantine    admins: serve it again
//
// The public route never touches D1: a request for a key reads the public bucket and nothing
// else, which is all the bucket's custom domain would do too.
// ============================================================

import { getSession } from '@ottabase/auth/backend';
import { AuditLog } from '@ottabase/ottaorm';
import {
    canChangeFile,
    canModerateFile,
    FilesError,
    type FileOwner,
    type FileRecord,
    type FileViewer,
} from '@ottabase/ottaupload/server';
import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { files } from '../../ottabase/files';
import { getAuthOptions } from '../lib/auth-utils';
import { initDbConnection } from '../lib/db-utils';
import { enforceUploadRateLimit } from '../lib/rate-limiting';
import { readJson } from '../lib/utils';
import type { ApiRouteContext } from './router';

const FILE_ID_RE = /^[0-9a-f]{32}$/;
/** Multipart framing on top of the largest purpose's bytes: anything bigger is refused unread. */
const MULTIPART_OVERHEAD = 64 * 1024;

/** A refused files operation as an API error; anything else is rethrown to the 5xx boundary. */
function filesErrorResponse(error: unknown): Response {
    if (error instanceof FilesError) return errorResponse(error.message, error.status, { code: error.code });
    throw error;
}

/** The signed-in viewer, from the verified session. Null when anonymous. */
export async function fileViewer(request: Request, env: CloudflareEnv): Promise<FileViewer | null> {
    const session = await getSession(request, env as never, getAuthOptions(env));
    const user = session?.user;
    if (!user?.id) return null;
    const permissions = (user.permissions as string[] | undefined) ?? [];
    return {
        userId: user.id,
        organizationId: (user.organizationId as string | null | undefined) ?? null,
        admin: hasGrantedPermission(permissions, 'org:admin') || hasGrantedPermission(permissions, 'media:manage'),
        // The session's scope-aware flag, derived from SYSTEM-scoped grants only.
        platformAdmin: user.platformAdmin === true,
    };
}

/** Who owns what the viewer uploads: the app from config, the org from the session. */
export function fileOwner(env: CloudflareEnv, viewer: FileViewer): FileOwner {
    return { appId: getOttabaseConfig(env).appId, userId: viewer.userId, organizationId: viewer.organizationId };
}

/** POST /api/files */
export async function handleFilesUpload(context: ApiRouteContext): Promise<Response> {
    const { request, env } = context;
    // Authenticate before reading the body, so an anonymous caller cannot make the Worker buffer it.
    const viewer = await fileViewer(request, env);
    if (!viewer) return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    const limited = await enforceUploadRateLimit(request, env, viewer.userId);
    if (limited) return limited;

    // Content-Length is an early refusal only; the service caps the bytes it actually reads.
    const largest = Math.max(0, ...files.purposes(env).map((purpose) => purpose.maxBytes));
    const declared = Number(request.headers.get('Content-Length'));
    if (Number.isFinite(declared) && declared > largest + MULTIPART_OVERHEAD) {
        return errorResponse('The upload is too large', 413, { code: 'PAYLOAD_TOO_LARGE' });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    const name = String(form?.get('purpose') ?? '');
    const purpose = files.purpose(env, name);
    // A `server` purpose belongs to its own route (avatars, brand assets, share images).
    if (!purpose || purpose.server) {
        return errorResponse('Unknown file purpose', 400, { code: 'UNKNOWN_PURPOSE' });
    }
    if (!(file instanceof File)) return errorResponse('file is required', 400, { code: 'BAD_REQUEST' });

    initDbConnection(env);
    try {
        const view = await files.put(env, {
            purpose: name,
            owner: fileOwner(env, viewer),
            file,
            title: typeof form?.get('title') === 'string' ? (form.get('title') as string) : null,
            altText: typeof form?.get('altText') === 'string' ? (form.get('altText') as string) : null,
        });
        return jsonResponse({ success: true, file: view }, 201);
    } catch (error) {
        return filesErrorResponse(error);
    }
}

/** GET|HEAD /api/files/public/* */
export async function handleFilesPublic(context: ApiRouteContext, key: string): Promise<Response> {
    try {
        return await files.servePublic(context.env, context.request, key);
    } catch (error) {
        return filesErrorResponse(error);
    }
}

/** GET|HEAD /api/files/:id[/:variant] */
export async function handleFilesRead(context: ApiRouteContext, id: string, variant?: string): Promise<Response> {
    if (!FILE_ID_RE.test(id)) return errorResponse('File not found', 404, { code: 'NOT_FOUND' });
    const { request, env, url } = context;
    initDbConnection(env);
    try {
        return await files.read(env, request, {
            id,
            variant: variant ?? null,
            viewer: await fileViewer(request, env),
            token: url.searchParams.get('t'),
        });
    } catch (error) {
        return filesErrorResponse(error);
    }
}

/** The file, when the viewer may change it; else the response that says why not. */
async function changeable(context: ApiRouteContext, id: string) {
    const viewer = await fileViewer(context.request, context.env);
    if (!viewer) return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    initDbConnection(context.env);
    const record = FILE_ID_RE.test(id) ? await files.get(context.env, id) : null;
    if (!record) return errorResponse('File not found', 404, { code: 'NOT_FOUND' });
    if (!canChangeFile(record, viewer)) return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    return record;
}

/** PATCH /api/files/:id */
export async function handleFilesUpdate(context: ApiRouteContext, id: string): Promise<Response> {
    const record = await changeable(context, id);
    if (record instanceof Response) return record;
    const body = await readJson<{ title?: unknown; altText?: unknown; caption?: unknown }>(context.request);
    const text = (value: unknown) => (value === undefined ? undefined : typeof value === 'string' ? value : null);
    const view = await files.update(context.env, id, {
        title: text(body.title),
        altText: text(body.altText),
        caption: text(body.caption),
    });
    return view
        ? jsonResponse({ success: true, file: view })
        : errorResponse('File not found', 404, { code: 'NOT_FOUND' });
}

/** DELETE /api/files/:id */
export async function handleFilesDelete(context: ApiRouteContext, id: string): Promise<Response> {
    const record = await changeable(context, id);
    if (record instanceof Response) return record;
    // An avatar, a brand asset or a share image is referenced by the row that uses it: it goes
    // when that row replaces or drops it, never from here (that would leave a dangling key).
    if (files.purpose(context.env, record.purpose)?.server) {
        return errorResponse('This file is managed where it is used', 409, { code: 'FILE_IN_USE' });
    }
    try {
        await files.remove(context.env, id);
    } catch (error) {
        return filesErrorResponse(error);
    }
    return jsonResponse({ success: true, data: { id } });
}

/** One audit row per moderation action. */
async function auditModeration(
    context: ApiRouteContext,
    viewer: FileViewer,
    record: FileRecord,
    action: 'files.quarantine' | 'files.restore',
    metadata: Record<string, unknown> = {},
): Promise<void> {
    try {
        await AuditLog.log({
            userId: viewer.userId,
            organizationId: record.organizationId ?? undefined,
            appId: record.appId,
            action,
            resourceType: 'media',
            resourceId: record.id,
            metadata: { purpose: record.purpose, audience: record.audience, ...metadata },
            ipAddress: context.request.headers.get('cf-connecting-ip') ?? undefined,
            userAgent: context.request.headers.get('user-agent')?.slice(0, 200) ?? undefined,
            status: 'success',
        });
    } catch (error) {
        console.error(JSON.stringify({ event: 'files_audit_failed', action, error: redactErrorForLog(error) }));
    }
}

/** The file, when the viewer may moderate it; else the response that says why not. */
async function moderatable(context: ApiRouteContext, id: string) {
    const viewer = await fileViewer(context.request, context.env);
    if (!viewer) return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    initDbConnection(context.env);
    const record = FILE_ID_RE.test(id) ? await files.get(context.env, id) : null;
    if (!record) return errorResponse('File not found', 404, { code: 'NOT_FOUND' });
    if (!canModerateFile(record, viewer)) return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    return { viewer, record };
}

/**
 * POST /api/files/:id/quarantine — stop serving a file. Answers `{ file, purge, urls }`: with
 * `purge: 'manual'` the URLs are still cached at the edge and must be purged by hand.
 */
export async function handleFilesQuarantine(context: ApiRouteContext, id: string): Promise<Response> {
    const allowed = await moderatable(context, id);
    if (allowed instanceof Response) return allowed;
    try {
        const result = await files.quarantine(context.env, id, { origin: context.url.origin });
        if (!result) return errorResponse('File not found', 404, { code: 'NOT_FOUND' });
        await auditModeration(context, allowed.viewer, allowed.record, 'files.quarantine', { purge: result.purge });
        return jsonResponse({ success: true, ...result });
    } catch (error) {
        return filesErrorResponse(error);
    }
}

/** DELETE /api/files/:id/quarantine — serve a quarantined file again. */
export async function handleFilesRestore(context: ApiRouteContext, id: string): Promise<Response> {
    const allowed = await moderatable(context, id);
    if (allowed instanceof Response) return allowed;
    try {
        const file = await files.restore(context.env, id);
        if (!file) return errorResponse('File not found', 404, { code: 'NOT_FOUND' });
        await auditModeration(context, allowed.viewer, allowed.record, 'files.restore');
        return jsonResponse({ success: true, file });
    } catch (error) {
        return filesErrorResponse(error);
    }
}
