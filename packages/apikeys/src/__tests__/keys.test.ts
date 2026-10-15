import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-in for the model: the same static calls, a real `toView()`.
const rows: Array<Record<string, unknown>> = [];
vi.mock('../ottaorm-models/ApiKey', async () => {
    const actual = await vi.importActual<typeof import('../ottaorm-models/ApiKey')>('../ottaorm-models/ApiKey');
    const wrap = (row: Record<string, unknown>) => new FakeApiKey({ entity: 'api_keys', data: { ...row } });
    const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
        Object.entries(where).every(([key, value]) => (row[key] ?? null) === (value ?? null));
    class FakeApiKey extends actual.ApiKey {
        static override async where(
            where: Record<string, unknown>,
            options?: { orderBy?: string; orderDirection?: string },
        ): Promise<any> {
            let list = rows.filter((row) => matches(row, where));
            if (options?.orderBy) {
                const key = options.orderBy;
                list = [...list].sort(
                    (a, b) => (Number(a[key]) - Number(b[key])) * (options.orderDirection === 'desc' ? -1 : 1),
                );
            }
            return list.map(wrap);
        }
        static override async first(where: Record<string, unknown>): Promise<any> {
            return (await this.where(where))[0] ?? null;
        }
        static override async create(data: Record<string, unknown>): Promise<any> {
            const row = {
                id: `k-${rows.length + 1}`,
                lastUsedAt: null,
                revokedAt: null,
                createdAt: 1_700_000_000_000 + rows.length,
                ...data,
            };
            rows.push(row);
            return wrap(row);
        }
        static override async update(id: string | number, data: Record<string, unknown>): Promise<any> {
            const row = rows.find((entry) => entry.id === id);
            if (row) Object.assign(row, data);
            return row ? wrap(row) : null;
        }
    }
    return { ...actual, ApiKey: FakeApiKey };
});

import { createApiKeys, randomSecret, sha256Hex, type Subject } from '../index';

type Env = Record<string, never>;
const env: Env = {};
const me: Subject = { appId: 'app', organizationId: 'org-1', userId: 'u-1' };
const bearer = (token: string) => new Request('https://api.test/x', { headers: { authorization: `Bearer ${token}` } });

function setup(now = 1_700_000_000_000) {
    let clock = now;
    const keys = createApiKeys<Env>({ now: () => clock, touchIntervalMs: 1_000 });
    return { keys, tick: (ms: number) => (clock += ms) };
}

describe('key material', () => {
    it('is base62 of the requested length, from rejection-sampled bytes', () => {
        const secret = randomSecret(40);
        expect(secret).toMatch(/^[A-Za-z0-9]{40}$/);
        // A deterministic source that only yields "rejected" bytes first still terminates with a fair pick.
        const fed = randomSecret(4, (n) => Uint8Array.from({ length: n }, (_, i) => (i < 3 ? 255 : 0)));
        expect(fed).toBe('AAAA');
    });

    it('hashes with SHA-256 hex', async () => {
        expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
});

describe('createApiKeys', () => {
    beforeEach(() => {
        rows.length = 0;
    });

    it('issues a key shown once, stores only its hash, and verifies it in one lookup', async () => {
        const { keys } = setup();
        const issued = await keys.issue(env, me, { name: 'CI', scopes: ['read', 'events:ingest'] });
        expect(issued.key).toMatch(/^ok_live_[A-Za-z0-9]{40}$/);
        expect(issued.record.prefix).toBe(issued.key.slice(0, 16));
        expect(rows[0].hash).toBe(await sha256Hex(issued.key));
        expect(JSON.stringify(rows[0])).not.toContain(issued.key.slice(16));

        const verified = await keys.verify(env, issued.key);
        expect(verified).toMatchObject({ ok: true, subject: me });
        expect(await keys.verify(env, issued.key, { scopes: ['read'] })).toMatchObject({ ok: true });
        expect(await keys.verify(env, issued.key, { scopes: ['admin'] })).toMatchObject({ ok: false, reason: 'SCOPE' });
    });

    it('refuses missing, malformed, unknown, revoked and expired keys by reason', async () => {
        const { keys, tick } = setup();
        expect(await keys.verify(env, null)).toEqual({ ok: false, reason: 'MISSING' });
        expect(await keys.verify(env, 'nope')).toEqual({ ok: false, reason: 'MALFORMED' });
        expect(await keys.verify(env, `ok_live_${'a'.repeat(40)}`)).toEqual({ ok: false, reason: 'NOT_FOUND' });

        const expiring = await keys.issue(env, me, { name: 'short', expiresAt: 1_700_000_000_000 + 10 });
        tick(11);
        expect(await keys.verify(env, expiring.key)).toMatchObject({ ok: false, reason: 'EXPIRED' });

        const revokable = await keys.issue(env, me, { name: 'old' });
        expect((await keys.revoke(env, me, revokable.record.id))?.revokedAt).not.toBeNull();
        expect(await keys.verify(env, revokable.key)).toMatchObject({ ok: false, reason: 'REVOKED' });
        expect(await keys.revoke(env, { ...me, userId: 'someone-else' }, revokable.record.id)).toBeNull();
    });

    it('touches lastUsedAt at most once per interval', async () => {
        const { keys, tick } = setup();
        const issued = await keys.issue(env, me, { name: 'k' });
        await keys.verify(env, issued.key);
        const first = rows[0].lastUsedAt;
        expect(first).toBe(1_700_000_000_000);
        tick(500);
        await keys.verify(env, issued.key);
        expect(rows[0].lastUsedAt).toBe(first);
        tick(600);
        await keys.verify(env, issued.key);
        expect(rows[0].lastUsedAt).toBe(1_700_000_001_100);
    });

    it('lists per subject, caps active keys, and validates names and scopes', async () => {
        const { keys } = setup();
        const capped = createApiKeys<Env>({ maxKeysPerSubject: 1 });
        await capped.issue(env, me, { name: 'one' });
        await expect(capped.issue(env, me, { name: 'two' })).rejects.toThrow(/at most 1/);
        await expect(keys.issue(env, me, { name: '' })).rejects.toThrow(/name is required/);
        await expect(keys.issue(env, me, { name: 'x', scopes: ['has space'] })).rejects.toThrow(/scope/);
        await expect(
            keys.issue(env, { appId: 'app', organizationId: null, userId: null }, { name: 'x' }),
        ).rejects.toThrow(/belong/);
        expect((await keys.list(env, me)).map((key) => key.name)).toEqual(['one']);
        expect(await keys.list(env, { appId: 'app', organizationId: 'org-1', userId: null })).toEqual([]);
    });

    it('authenticate reads Bearer or X-Api-Key, answers 401/403, and lets afterVerify refuse', async () => {
        const refuse = vi.fn(async () => null as Response | null);
        const keys = createApiKeys<Env>({ afterVerify: refuse });
        const issued = await keys.issue(env, me, { name: 'k', scopes: ['read'] });

        const ok = await keys.authenticate(bearer(issued.key), env, { scopes: ['read'] });
        expect(ok).toMatchObject({ ok: true });
        expect(refuse).toHaveBeenCalledTimes(1);

        const viaHeader = await keys.authenticate(
            new Request('https://api.test/x', { headers: { 'x-api-key': issued.key } }),
            env,
        );
        expect(viaHeader).toMatchObject({ ok: true });

        const missing = (await keys.authenticate(new Request('https://api.test/x'), env)) as Response;
        expect(missing.status).toBe(401);
        expect(((await missing.json()) as { metadata: { reason: string } }).metadata.reason).toBe('MISSING');

        const forbidden = (await keys.authenticate(bearer(issued.key), env, { scopes: ['write'] })) as Response;
        expect(forbidden.status).toBe(403);

        refuse.mockResolvedValueOnce(new Response('slow down', { status: 429 }));
        expect(((await keys.authenticate(bearer(issued.key), env)) as Response).status).toBe(429);
    });
});
