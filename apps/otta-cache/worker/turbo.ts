/**
 * Turborepo remote cache protocol (v8). Spec: https://turborepo.dev/api/remote-cache-spec
 * Route behaviour only; R2 access goes through ./store, auth through ./auth.
 */
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';

import type { Env } from '../cloudflare-env';
import { authorize, bearerToken, parseTokens, type Grant } from './auth';
import * as store from './store';
import type { ArtifactHead, ArtifactMeta } from './store';

const TEAM_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
// Spec: ^[a-fA-F0-9]+$, minLength 1, no max. 128 is our own sanity ceiling (turbo emits 16 today).
const HASH_RE = /^[a-fA-F0-9]{1,128}$/;
const TAG_MAX = 600; // spec maxLength for x-artifact-tag
// Workers free plan: 50 subrequests per request; one R2 head per hash. 40 leaves headroom.
const MAX_BATCH_HASHES = 40;
const DEFAULT_MAX_ARTIFACT_MB = 100;

const ARTIFACT_PATH = /^\/v8\/artifacts\/([^/]+)$/;

export async function handleTurbo(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS' && path.startsWith('/v8/artifacts')) {
        return new Response(null, { status: 204 });
    }
    if (!path.startsWith('/v8/artifacts')) {
        return errorResponse('Not found', 404);
    }

    const bearer = bearerToken(request);
    if (!bearer) return errorResponse('Unauthorized', 401);

    const team = url.searchParams.get('slug') ?? url.searchParams.get('teamId') ?? '';
    if (!TEAM_RE.test(team)) return errorResponse('Missing or invalid team (slug/teamId)', 400);

    const grant = await authorize(parseTokens(env.TURBO_CACHE_TOKENS), bearer, team);
    if (grant === 'unauthorized') return errorResponse('Unauthorized', 401);
    if (grant === 'forbidden') return errorResponse('Token not allowed for this team', 403);

    if (path === '/v8/artifacts/status' && request.method === 'GET') {
        return jsonResponse({ status: 'enabled' });
    }
    if (path === '/v8/artifacts/events' && request.method === 'POST') {
        // Deliberately unread: event payloads carry hashes and session ids and nothing here needs them.
        return jsonResponse({});
    }
    if (path === '/v8/artifacts' && request.method === 'POST') {
        return queryArtifacts(request, env, team);
    }

    const match = ARTIFACT_PATH.exec(path);
    if (match && match[1] !== 'status' && match[1] !== 'events') {
        const hash = match[1];
        if (!HASH_RE.test(hash)) return errorResponse('Invalid artifact hash', 400);
        switch (request.method) {
            case 'HEAD':
                return headArtifact(env, team, hash);
            case 'GET':
                return getArtifact(env, team, hash);
            case 'PUT':
                return putArtifact(request, env, team, hash, grant, url.origin);
            default:
                return errorResponse('Method not allowed', 405);
        }
    }

    return errorResponse('Not found', 404);
}

function artifactHeaders(head: ArtifactHead): Headers {
    const h = new Headers({
        'Content-Length': String(head.size),
        'Content-Type': 'application/octet-stream',
    });
    if (head.meta.duration !== undefined) h.set('x-artifact-duration', String(head.meta.duration));
    if (head.meta.tag !== undefined) h.set('x-artifact-tag', head.meta.tag);
    if (head.meta.sha !== undefined) h.set('x-artifact-sha', head.meta.sha);
    if (head.meta.dirtyHash !== undefined) h.set('x-artifact-dirty-hash', head.meta.dirtyHash);
    return h;
}

async function headArtifact(env: Env, team: string, hash: string): Promise<Response> {
    const head = await store.head(env.CACHE_R2, team, hash);
    if (!head) return errorResponse('Artifact not found', 404);
    return new Response(null, { status: 200, headers: artifactHeaders(head) });
}

async function getArtifact(env: Env, team: string, hash: string): Promise<Response> {
    const obj = await store.get(env.CACHE_R2, team, hash);
    if (!obj) return errorResponse('Artifact not found', 404);
    return new Response(obj.body, { status: 200, headers: artifactHeaders(obj) });
}

function readMeta(request: Request): ArtifactMeta | Response {
    const meta: ArtifactMeta = {};
    const tag = request.headers.get('x-artifact-tag');
    if (tag !== null) {
        if (tag.length === 0 || tag.length > TAG_MAX) return errorResponse('Invalid x-artifact-tag', 400);
        meta.tag = tag;
    }
    const duration = request.headers.get('x-artifact-duration');
    if (duration !== null && /^\d{1,15}$/.test(duration)) meta.duration = Number(duration);
    const sha = request.headers.get('x-artifact-sha');
    if (sha !== null && HASH_RE.test(sha)) meta.sha = sha;
    const dirtyHash = request.headers.get('x-artifact-dirty-hash');
    if (dirtyHash !== null && HASH_RE.test(dirtyHash)) meta.dirtyHash = dirtyHash;
    return meta;
}

async function putArtifact(
    request: Request,
    env: Env,
    team: string,
    hash: string,
    grant: Grant,
    origin: string,
): Promise<Response> {
    if (!grant.write) return errorResponse('Token is read-only', 403);

    const length = Number(request.headers.get('content-length'));
    if (!Number.isInteger(length) || length < 1) return errorResponse('Content-Length required', 400);
    const maxMb = Number(env.MAX_ARTIFACT_MB);
    const maxBytes = (maxMb > 0 ? maxMb : DEFAULT_MAX_ARTIFACT_MB) * 1024 * 1024;
    if (length > maxBytes) return errorResponse('Artifact too large', 413);

    const meta = readMeta(request);
    if (meta instanceof Response) return meta;
    if (env.REQUIRE_SIGNED_UPLOADS === '1' && meta.tag === undefined) {
        return errorResponse('x-artifact-tag required (signed uploads enforced)', 400);
    }
    if (!request.body) return errorResponse('Empty body', 400);

    const outcome = await store.put(env.CACHE_R2, team, hash, request.body, meta);
    const urls = [`${origin}/v8/artifacts/${hash}?slug=${team}`];
    // Existing key: content-addressed, so the stored artifact is authoritative. Not an error.
    return jsonResponse({ urls }, outcome === 'created' ? 202 : 200);
}

async function queryArtifacts(request: Request, env: Env, team: string): Promise<Response> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid JSON', 400);
    }
    const hashes = (body as { hashes?: unknown } | null)?.hashes;
    if (!Array.isArray(hashes) || hashes.length > MAX_BATCH_HASHES) {
        return errorResponse(`hashes must be an array of at most ${MAX_BATCH_HASHES}`, 400);
    }
    if (!hashes.every((h) => typeof h === 'string' && HASH_RE.test(h))) {
        return errorResponse('Invalid artifact hash', 400);
    }
    const heads = await Promise.all((hashes as string[]).map((h) => store.head(env.CACHE_R2, team, h)));
    const result: Record<string, { size: number; taskDurationMs: number; tag?: string } | null> = {};
    (hashes as string[]).forEach((h, i) => {
        const head = heads[i];
        result[h] = head
            ? {
                  size: head.size,
                  taskDurationMs: head.meta.duration ?? 0,
                  ...(head.meta.tag ? { tag: head.meta.tag } : {}),
              }
            : null;
    });
    return jsonResponse(result);
}
