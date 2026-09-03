import { describe, expect, it } from 'vitest';

import type { Env } from '../cloudflare-env';
import worker from '../worker/index';
import { sha256Hex } from '../worker/auth';

/**
 * In-memory R2. Models the one semantic the worker depends on: `put` with `onlyIf` returns null
 * when the key already exists and leaves the stored body untouched.
 */
class FakeBucket {
    objects = new Map<string, { body: Uint8Array; customMetadata: Record<string, string> }>();

    async head(key: string) {
        const o = this.objects.get(key);
        return o ? { key, size: o.body.byteLength, customMetadata: o.customMetadata } : null;
    }
    async get(key: string) {
        const o = this.objects.get(key);
        if (!o) return null;
        return {
            key,
            size: o.body.byteLength,
            customMetadata: o.customMetadata,
            body: new Blob([o.body]).stream(),
        };
    }
    async put(key: string, body: ReadableStream, opts?: { onlyIf?: unknown; customMetadata?: Record<string, string> }) {
        if (opts?.onlyIf && this.objects.has(key)) return null;
        const bytes = new Uint8Array(await new Response(body).arrayBuffer());
        this.objects.set(key, { body: bytes, customMetadata: opts?.customMetadata ?? {} });
        return { key, size: bytes.byteLength };
    }
}

const RW = 'rw-token';
const RO = 'ro-token';
const OTHER = 'other-team-token';
const HASH = 'deadbeefdeadbeef';

async function makeEnv(overrides: Partial<Env> = {}): Promise<Env & { bucket: FakeBucket }> {
    const bucket = new FakeBucket();
    const tokens = {
        'ci-rw': { sha256: await sha256Hex(RW), teams: ['ottabase'], write: true },
        'dev-ro': { sha256: await sha256Hex(RO), teams: ['*'], write: false },
        other: { sha256: await sha256Hex(OTHER), teams: ['someone-else'], write: true },
    };
    return {
        bucket,
        CACHE_R2: bucket as unknown as R2Bucket,
        TURBO_CACHE_TOKENS: JSON.stringify(tokens),
        ...overrides,
    };
}

function req(
    method: string,
    path: string,
    { token, body, headers = {} }: { token?: string; body?: string; headers?: Record<string, string> } = {},
): Request {
    const h = new Headers(headers);
    if (token) h.set('authorization', `Bearer ${token}`);
    if (body !== undefined) h.set('content-length', String(new TextEncoder().encode(body).byteLength));
    return new Request(`https://cache.test${path}`, { method, headers: h, body });
}

const put = (env: Env, body = 'artifact-bytes', extra: Record<string, string> = {}, token = RW) =>
    worker.fetch(
        req('PUT', `/v8/artifacts/${HASH}?slug=ottabase`, {
            token,
            body,
            headers: { 'x-artifact-duration': '123', 'x-artifact-tag': 'c2lnbmF0dXJl', ...extra },
        }),
        env,
    );

describe('otta-cache worker', () => {
    it('serves /health without auth', async () => {
        const res = await worker.fetch(req('GET', '/health'), await makeEnv());
        expect(res.status).toBe(200);
    });

    it('401 without a token, 401 with an unknown token, 401 when the token map is malformed', async () => {
        const env = await makeEnv();
        expect((await worker.fetch(req('GET', '/v8/artifacts/status?slug=ottabase'), env)).status).toBe(401);
        expect(
            (await worker.fetch(req('GET', '/v8/artifacts/status?slug=ottabase', { token: 'nope' }), env)).status,
        ).toBe(401);
        const broken = await makeEnv({ TURBO_CACHE_TOKENS: '{not json' });
        expect(
            (await worker.fetch(req('GET', '/v8/artifacts/status?slug=ottabase', { token: RW }), broken)).status,
        ).toBe(401);
    });

    it('400 when team is missing, 403 when the token is not allowed for the team', async () => {
        const env = await makeEnv();
        expect((await worker.fetch(req('GET', '/v8/artifacts/status', { token: RW }), env)).status).toBe(400);
        expect(
            (await worker.fetch(req('GET', '/v8/artifacts/status?slug=ottabase', { token: OTHER }), env)).status,
        ).toBe(403);
        expect(
            (await worker.fetch(req('GET', '/v8/artifacts/status?teamId=ottabase', { token: RW }), env)).status,
        ).toBe(200);
    });

    it('status, events and OPTIONS', async () => {
        const env = await makeEnv();
        const status = await worker.fetch(req('GET', '/v8/artifacts/status?slug=ottabase', { token: RW }), env);
        expect(await status.json()).toEqual({ status: 'enabled' });
        const events = await worker.fetch(
            req('POST', '/v8/artifacts/events?slug=ottabase', { token: RW, body: 'not even json' }),
            env,
        );
        expect(events.status).toBe(200);
        expect((await worker.fetch(req('OPTIONS', '/v8/artifacts/abc?slug=ottabase'), env)).status).toBe(204);
        expect((await worker.fetch(req('GET', '/nope'), env)).status).toBe(404);
    });

    it('PUT -> HEAD -> GET round-trip preserves body and metadata headers', async () => {
        const env = await makeEnv();
        const created = await put(env, 'artifact-bytes', { 'x-artifact-sha': 'abc123' });
        expect(created.status).toBe(202);
        expect(await created.json()).toEqual({ urls: [`https://cache.test/v8/artifacts/${HASH}?slug=ottabase`] });

        const head = await worker.fetch(req('HEAD', `/v8/artifacts/${HASH}?slug=ottabase`, { token: RO }), env);
        expect(head.status).toBe(200);
        expect(head.headers.get('content-length')).toBe('14');
        expect(head.headers.get('x-artifact-duration')).toBe('123');
        expect(head.headers.get('x-artifact-tag')).toBe('c2lnbmF0dXJl');
        expect(head.headers.get('x-artifact-sha')).toBe('abc123');

        const get = await worker.fetch(req('GET', `/v8/artifacts/${HASH}?slug=ottabase`, { token: RO }), env);
        expect(get.status).toBe(200);
        expect(await get.text()).toBe('artifact-bytes');
        expect(get.headers.get('x-artifact-tag')).toBe('c2lnbmF0dXJl');
    });

    it('second PUT to the same hash is a 200 no-op and the first body wins', async () => {
        const env = await makeEnv();
        expect((await put(env, 'first')).status).toBe(202);
        expect((await put(env, 'second-different')).status).toBe(200);
        const get = await worker.fetch(req('GET', `/v8/artifacts/${HASH}?slug=ottabase`, { token: RW }), env);
        expect(await get.text()).toBe('first');
    });

    it('read-only token cannot PUT', async () => {
        const env = await makeEnv();
        expect((await put(env, 'x', {}, RO)).status).toBe(403);
    });

    it('PUT validation: bad hash, missing Content-Length, too large, bad tag, unsigned in production', async () => {
        const env = await makeEnv({ MAX_ARTIFACT_MB: '1' });
        expect(
            (await worker.fetch(req('PUT', '/v8/artifacts/not-hex!?slug=ottabase', { token: RW, body: 'x' }), env))
                .status,
        ).toBe(400);
        const noLength = new Request(`https://cache.test/v8/artifacts/${HASH}?slug=ottabase`, {
            method: 'PUT',
            headers: { authorization: `Bearer ${RW}` },
        });
        expect((await worker.fetch(noLength, env)).status).toBe(400);
        const zeroLength = req('PUT', `/v8/artifacts/${HASH}?slug=ottabase`, { token: RW, body: '' });
        expect((await worker.fetch(zeroLength, env)).status).toBe(400);
        const badCap = await makeEnv({ MAX_ARTIFACT_MB: '-5' });
        expect((await put(badCap)).status).toBe(202);
        const big = req('PUT', `/v8/artifacts/${HASH}?slug=ottabase`, { token: RW, body: 'x' });
        big.headers.set('content-length', String(2 * 1024 * 1024));
        expect((await worker.fetch(big, env)).status).toBe(413);
        expect((await put(env, 'x', { 'x-artifact-tag': '' })).status).toBe(400);
        expect((await put(env, 'x', { 'x-artifact-tag': 'a'.repeat(601) })).status).toBe(400);

        const prod = await makeEnv({ REQUIRE_SIGNED_UPLOADS: '1' });
        const unsigned = worker.fetch(
            req('PUT', `/v8/artifacts/${HASH}?slug=ottabase`, {
                token: RW,
                body: 'x',
                headers: { 'x-artifact-duration': '1' },
            }),
            prod,
        );
        expect((await unsigned).status).toBe(400);
        expect((await put(prod)).status).toBe(202);
        // Unsigned is fine when enforcement is off (local dev).
        const dev = await makeEnv();
        expect(
            (await worker.fetch(req('PUT', `/v8/artifacts/${HASH}?slug=ottabase`, { token: RW, body: 'x' }), dev))
                .status,
        ).toBe(202);
    });

    it('GET/HEAD miss -> 404; artifacts are namespaced per team', async () => {
        const env = await makeEnv();
        await put(env);
        expect(
            (await worker.fetch(req('HEAD', `/v8/artifacts/${HASH}?slug=ottabase`, { token: RO }), env)).status,
        ).toBe(200);
        expect(
            (await worker.fetch(req('GET', `/v8/artifacts/0123456789abcdef?slug=ottabase`, { token: RO }), env)).status,
        ).toBe(404);
        expect((await worker.fetch(req('GET', `/v8/artifacts/${HASH}?slug=another`, { token: RO }), env)).status).toBe(
            404,
        );
    });

    it('POST /v8/artifacts returns the spec ArtifactInfo shape and enforces the batch cap', async () => {
        const env = await makeEnv();
        await put(env);
        const res = await worker.fetch(
            req('POST', '/v8/artifacts?slug=ottabase', { token: RO, body: JSON.stringify({ hashes: [HASH, 'ffff'] }) }),
            env,
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            [HASH]: { size: 14, taskDurationMs: 123, tag: 'c2lnbmF0dXJl' },
            ffff: null,
        });
        const tooMany = { hashes: Array.from({ length: 41 }, (_, i) => i.toString(16).padStart(4, '0')) };
        expect(
            (
                await worker.fetch(
                    req('POST', '/v8/artifacts?slug=ottabase', { token: RO, body: JSON.stringify(tooMany) }),
                    env,
                )
            ).status,
        ).toBe(400);
        expect(
            (
                await worker.fetch(
                    req('POST', '/v8/artifacts?slug=ottabase', { token: RO, body: '{"hashes":["zz"]}' }),
                    env,
                )
            ).status,
        ).toBe(400);
    });
});
