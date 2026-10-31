import { beforeEach, describe, expect, it, vi } from 'vitest';
import { describeUserAgent, maskIp } from '../device';
import {
    createSessionForUser,
    findUserSessionJti,
    getSession,
    listUserSessions,
    renameUserSession,
    revokeAllUserSessions,
    revokeOtherUserSessions,
    revokeUserSessionById,
    purgeUserSessions,
    revokeSession,
    sessionPublicId,
    wasSessionRevoked,
} from '../session-store';
import type { AuthEnv } from '../types';

const { userFind, memberWhere } = vi.hoisted(() => ({ userFind: vi.fn(), memberWhere: vi.fn() }));
vi.mock('@ottabase/ottaorm/models', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ottabase/ottaorm/models')>()),
    User: { find: userFind },
    OrganizationMember: { where: memberWhere },
}));

const TEST_SECRET = 'test-secret-at-least-32-chars-long!!';

/** In-memory KV with metadata and prefix listing: what the sessions page needs. */
function createFakeKv() {
    const store = new Map<string, { value: string; metadata?: unknown; expiration?: number }>();
    return {
        store,
        async get(key: string) {
            return store.get(key)?.value ?? null;
        },
        async getWithMetadata(key: string) {
            const entry = store.get(key);
            return { value: entry?.value ?? null, metadata: entry?.metadata ?? null };
        },
        async put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }) {
            store.set(key, {
                value,
                metadata: options?.metadata,
                expiration: options?.expirationTtl ? Math.floor(Date.now() / 1000) + options.expirationTtl : undefined,
            });
        },
        async delete(key: string) {
            store.delete(key);
        },
        async list(options: { prefix: string }) {
            return {
                keys: [...store.entries()]
                    .filter(([name]) => name.startsWith(options.prefix))
                    .map(([name, entry]) => ({ name, metadata: entry.metadata, expiration: entry.expiration })),
                list_complete: true,
            };
        },
    } as unknown as NonNullable<AuthEnv['OBCF_KV']> & { store: typeof store };
}

function createEnv(): AuthEnv {
    return {
        AUTH_SECRET: TEST_SECRET,
        ENVIRONMENT: 'test',
        OBCF_KV: createFakeKv(),
        OBCF_D1: {},
    } as unknown as AuthEnv;
}

function requestWithCookie(token: string, env: AuthEnv): Request {
    return new Request('http://localhost/', { headers: { Cookie: `ottabase.session-token=${token}` } });
}

beforeEach(() => {
    userFind.mockResolvedValue({ get: () => null, imageUrl: () => null, getUserRoles: async () => [] });
    memberWhere.mockResolvedValue([]);
});

describe('device facts', () => {
    it('summarises user agents and masks IPs', () => {
        expect(
            describeUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
            ),
        ).toBe('Chrome on Windows');
        expect(
            describeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605 Version/17 Safari/604'),
        ).toBe('Safari on iPhone');
        expect(describeUserAgent('Mozilla/5.0 (Windows) Chrome/124.0 Safari/537.36 Edg/124.0')).toBe('Edge on Windows');
        expect(describeUserAgent('')).toBe('Unknown device');
        expect(maskIp('203.0.113.42')).toBe('203.0.113.x');
        expect(maskIp('2001:db8:85a3::8a2e:370:7334')).toBe('2001:db8:85a3:…');
        expect(maskIp(null)).toBeNull();
    });
});

describe('user sessions listing', () => {
    it('stores device metadata on create and lists it, marking the current session', async () => {
        const env = createEnv();
        const a = await createSessionForUser(
            { id: 'u1', email: 'a@x', device: { userAgent: 'Chrome on Windows', ip: '1.2.3.x', geo: 'Mumbai, IN' } },
            env,
        );
        const b = await createSessionForUser(
            { id: 'u1', email: 'a@x', device: { userAgent: 'Safari on iPhone' } },
            env,
        );
        await createSessionForUser({ id: 'u2', email: 'b@x' }, env);

        const sessions = await listUserSessions('u1', env, b.jti);
        expect(sessions).toHaveLength(2);
        // Both may share a millisecond, so assert who is current, not the order.
        expect(sessions.filter((s) => s.current).map((s) => s.device)).toEqual(['Safari on iPhone']);
        const first = sessions.find((s) => s.device === 'Chrome on Windows')!;
        expect(first).toMatchObject({ ip: '1.2.3.x', geo: 'Mumbai, IN', name: null });
        expect(first.id).toBe(await sessionPublicId(a.jti, env));
        // Raw jtis never leave the server
        expect(JSON.stringify(sessions)).not.toContain(a.jti);
        expect(JSON.stringify(sessions)).not.toContain(b.jti);
    });

    it('round-trips an opaque id for the owner and refuses it for anyone else', async () => {
        const env = createEnv();
        const a = await createSessionForUser({ id: 'u1', email: 'a@x' }, env);
        const id = await sessionPublicId(a.jti, env);
        expect((await findUserSessionJti('u1', id, env))?.jti).toBe(a.jti);
        expect(await findUserSessionJti('u2', id, env)).toBeNull();
        expect(await revokeUserSessionById('u2', id, env)).toBe(false);
        expect(await getSession(requestWithCookie(a.token, env), env)).not.toBeNull();
    });

    it('renames keeping the device facts, and revoke-others leaves only the current session', async () => {
        const env = createEnv();
        const a = await createSessionForUser({ id: 'u1', email: 'a@x', device: { userAgent: 'Chrome on Linux' } }, env);
        const b = await createSessionForUser({ id: 'u1', email: 'a@x' }, env);
        const c = await createSessionForUser({ id: 'u1', email: 'a@x' }, env);

        const renamed = await renameUserSession('u1', await sessionPublicId(a.jti, env), '  Work laptop  ', env);
        expect(renamed?.name).toBe('Work laptop');
        expect(renamed?.device).toBe('Chrome on Linux');
        await expect(renameUserSession('u1', await sessionPublicId(a.jti, env), '   ', env)).rejects.toThrow(
            /required/,
        );

        expect(await revokeOtherUserSessions('u1', b.jti, env)).toBe(2);
        expect(await getSession(requestWithCookie(a.token, env), env)).toBeNull();
        expect(await getSession(requestWithCookie(c.token, env), env)).toBeNull();
        expect(await getSession(requestWithCookie(b.token, env), env)).not.toBeNull();
        expect((await listUserSessions('u1', env, b.jti)).map((s) => s.current)).toEqual([true]);
    });

    it('leaves out sessions killed by a password reset (revoked since) though KV still holds them', async () => {
        const env = createEnv();
        await createSessionForUser({ id: 'u1', email: 'a@x' }, env);
        // getSession rejects sessions strictly older than the marker; step past the millisecond.
        await new Promise((resolve) => setTimeout(resolve, 2));
        await revokeAllUserSessions('u1', env);
        await new Promise((resolve) => setTimeout(resolve, 2));
        const fresh = await createSessionForUser({ id: 'u1', email: 'a@x' }, env);
        const sessions = await listUserSessions('u1', env, fresh.jti);
        expect(sessions).toHaveLength(1);
        expect(sessions[0].current).toBe(true);
    });

    it('keeps metadata when a stale snapshot is refreshed', async () => {
        const env = createEnv();
        const a = await createSessionForUser(
            { id: 'u1', email: 'a@x', device: { userAgent: 'Firefox on macOS' } },
            env,
        );
        await env.OBCF_KV!.put('auth:usr:u1:profile:version', String(Date.now() + 5));
        expect(await getSession(requestWithCookie(a.token, env), env)).not.toBeNull();
        expect((await listUserSessions('u1', env))[0].device).toBe('Firefox on macOS');
    });

    it('tells a revoked session apart from a live one or no cookie at all', async () => {
        const env = createEnv();
        const live = await createSessionForUser({ id: 'u1', email: 'a@x' }, env);
        const killed = await createSessionForUser({ id: 'u1', email: 'a@x' }, env);
        await revokeSession('u1', killed.jti, env);
        expect(await wasSessionRevoked(requestWithCookie(killed.token, env), env)).toBe(true);
        expect(await wasSessionRevoked(requestWithCookie(live.token, env), env)).toBe(false);
        expect(await wasSessionRevoked(new Request('http://localhost/'), env)).toBe(false);

        await new Promise((resolve) => setTimeout(resolve, 2));
        await revokeAllUserSessions('u1', env);
        expect(await wasSessionRevoked(requestWithCookie(live.token, env), env)).toBe(true);
    });

    it('purges every session record for an erasure and signs the user out', async () => {
        const env = createEnv();
        const a = await createSessionForUser({ id: 'u1', email: 'a@x', device: { ip: '1.2.3.x' } }, env);
        await createSessionForUser({ id: 'u1', email: 'a@x' }, env);
        await createSessionForUser({ id: 'u2', email: 'b@x' }, env);
        expect(await purgeUserSessions('u1', env)).toBe(2);
        expect(await listUserSessions('u1', env)).toEqual([]);
        expect(await getSession(requestWithCookie(a.token, env), env)).toBeNull();
        expect(await listUserSessions('u2', env)).toHaveLength(1);
    });
});
