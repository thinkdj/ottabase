import { describe, expect, it, vi } from 'vitest';
import { createAuthConfig } from '../backend-handler';

function createMockD1() {
    const prepare = vi.fn((sql: string) => {
        const base = (() => {
            if (sql.includes('FROM organization_members')) {
                return {
                    first: vi.fn(async () => ({ organizationId: 'org-1' })),
                };
            }
            if (sql.includes('FROM user_roles')) {
                return {
                    all: vi.fn(async () => ({
                        results: [
                            {
                                name: 'member',
                                permissions: JSON.stringify(['*:read']),
                            },
                        ],
                    })),
                };
            }
            if (sql.toLowerCase().includes('update users set email_verified')) {
                return {
                    run: vi.fn(async () => ({ success: true })),
                };
            }
            if (sql.toLowerCase().includes('select count(*) as count from users')) {
                return {
                    first: vi.fn(async () => ({ count: 1 })),
                };
            }
            return {};
        })();

        const stub = {
            first: vi.fn(async () => null),
            all: vi.fn(async () => ({ results: [] })),
            run: vi.fn(async () => ({ success: true })),
            ...base,
        };

        return { ...stub, bind: vi.fn(() => stub) };
    });

    return { prepare };
}

describe('Auth Backend Handler', () => {
    it('injects organization, roles, and permissions into jwt token', async () => {
        const env = {
            OBCF_D1: createMockD1() as any,
            OBCF_KV: { get: vi.fn(async () => null) } as any,
            AUTH_SECRET: 'test-secret',
            ENVIRONMENT: 'test',
        };

        const config = createAuthConfig(env as any);
        const jwt = config.callbacks?.jwt!;

        const token = await jwt({
            token: {},
            user: { id: 'user-1', email: 'user@example.com', name: 'User One' },
        } as any);

        expect(token.id).toBe('user-1');
        expect(token.organizationId).toBe('org-1');
        expect(Array.isArray(token.roles)).toBe(true);
        expect(token.roles).toContain('member');
        expect(Array.isArray(token.permissions)).toBe(true);
        expect(token.permissions).toContain('*:read');
        expect(token.jti).toBeTruthy();
        expect(token.issuedAt).toBeTruthy();
    });

    it('maps organization, roles, and permissions into session', async () => {
        const env = {
            OBCF_D1: createMockD1() as any,
            AUTH_SECRET: 'test-secret',
            ENVIRONMENT: 'test',
        };

        const config = createAuthConfig(env as any);
        const sessionCb = config.callbacks?.session!;

        const session = await sessionCb({
            session: { user: {} },
            token: {
                id: 'user-1',
                email: 'user@example.com',
                name: 'User One',
                organizationId: 'org-1',
                roles: ['member'],
                permissions: ['*:read'],
            },
        } as any);

        expect(session.user.id).toBe('user-1');
        expect((session.user as any).organizationId).toBe('org-1');
        expect((session.user as any).roles).toEqual(['member']);
        expect((session.user as any).permissions).toEqual(['*:read']);
    });

    it('revokes session on signOut via KV', async () => {
        const kvPut = vi.fn(async () => undefined);
        const env = {
            OBCF_D1: createMockD1() as any,
            OBCF_KV: { get: vi.fn(), put: kvPut } as any,
            AUTH_SECRET: 'test-secret',
            ENVIRONMENT: 'test',
        };

        const config = createAuthConfig(env as any, { sessionMaxAge: 3600 });
        const signOut = config.events?.signOut!;

        await signOut({ token: { id: 'user-1' } } as any);

        expect(kvPut).toHaveBeenCalled();
        const [key, value, options] = kvPut.mock.calls[0];
        expect(key).toBe('auth:usr:user-1:revoked');
        expect(typeof value).toBe('string');
        expect(options.expirationTtl).toBe(3600);
    });

    it('auto-verifies OAuth users on signIn', async () => {
        const d1 = createMockD1();
        const env = {
            OBCF_D1: d1 as any,
            AUTH_SECRET: 'test-secret',
            ENVIRONMENT: 'test',
        };

        const config = createAuthConfig(env as any);
        const signIn = config.callbacks?.signIn!;

        const result = await signIn({
            user: { id: 'user-1', email: 'user@example.com' },
            account: { provider: 'google' },
        } as any);

        expect(result).toBe(true);
        expect(d1.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET email_verified'));
    });
});
