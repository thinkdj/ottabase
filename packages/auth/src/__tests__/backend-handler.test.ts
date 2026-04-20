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

        expect(token).not.toBeNull();
        if (!token) {
            throw new Error('Expected jwt callback to return a token');
        }

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

        expect(session.user).toBeDefined();
        if (!session.user) {
            throw new Error('Expected session callback to populate session.user');
        }

        expect(session.user.id).toBe('user-1');
        expect((session.user as any).organizationId).toBe('org-1');
        expect((session.user as any).roles).toEqual(['member']);
        expect((session.user as any).permissions).toEqual(['*:read']);
    });

    it('revokes session on signOut via KV', async () => {
        const kvPut = vi.fn(async (_key: string, _value: string, _options?: { expirationTtl?: number }) => undefined);
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
        const firstCall = kvPut.mock.calls[0];
        expect(firstCall).toBeDefined();
        if (!firstCall) {
            throw new Error('Expected KV put to be called during signOut');
        }

        const key = firstCall[0];
        const value = firstCall[1];
        const options = firstCall[2];
        expect(key).toBe('auth:usr:user-1:revoked');
        expect(typeof value).toBe('string');
        expect(options).toBeDefined();
        if (!options) {
            throw new Error('Expected KV put options to be provided');
        }

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

    it('re-reads currentOrgId and refreshes org/roles when profile version bumps', async () => {
        // Simulate: user switched orgs via POST /api/account/switch-org.
        // That endpoint writes `currentOrgId` + bumps `profile:version` in KV.
        // The jwt callback must re-read both and update the token on refresh.
        const prepare = vi.fn((sql: string) => {
            const stub: any = {
                first: vi.fn(async () => null),
                all: vi.fn(async () => ({ results: [] })),
                run: vi.fn(async () => ({ success: true })),
            };
            const lower = sql.toLowerCase();
            if (lower.includes('from organization_members') && lower.includes('organization_id = ?')) {
                // KV-hint branch: called with (userId, hint='org-new')
                stub.first = vi.fn(async () => ({ organizationId: 'org-new' }));
            } else if (lower.includes('from organization_members')) {
                // Fallback branch (should NOT be hit when KV hint resolves)
                stub.first = vi.fn(async () => ({ organizationId: 'org-stale' }));
            } else if (lower.includes('select r.name')) {
                stub.all = vi.fn(async () => ({
                    results: [{ name: 'admin', permissions: JSON.stringify(['*:read', '*:update']) }],
                }));
            } else if (lower.includes('from user_roles')) {
                // systemAdmin probe: user is not a system admin
                stub.first = vi.fn(async () => null);
            } else if (lower.includes('from users') && lower.includes('created_at')) {
                stub.first = vi.fn(async () => ({
                    name: 'User One',
                    email: 'user@example.com',
                    image: null,
                    emailVerified: null,
                    createdAt: 1700000000000,
                }));
            }
            return { ...stub, bind: vi.fn(() => stub) };
        });

        const kvStore = new Map<string, string>();
        kvStore.set('auth:usr:user-1:profile:version', '2');
        kvStore.set('auth:usr:user-1:profile:currentOrgId', 'org-new');

        const env = {
            OBCF_D1: { prepare } as any,
            OBCF_KV: { get: vi.fn(async (key: string) => kvStore.get(key) ?? null) } as any,
            AUTH_SECRET: 'test-secret',
            ENVIRONMENT: 'test',
        };

        const config = createAuthConfig(env as any);
        const jwt = config.callbacks?.jwt!;

        // Token carries the prior org + stale version, no fresh `user` (refresh path)
        const result = await jwt({
            token: {
                id: 'user-1',
                email: 'user@example.com',
                name: 'User One',
                organizationId: 'org-old',
                roles: ['member'],
                permissions: ['*:read'],
                systemAdmin: false,
                profileVersion: 1,
                jti: 'tok-1',
                issuedAt: 1,
            },
        } as any);

        expect(result).not.toBeNull();
        if (!result) throw new Error('Expected token');
        expect(result.organizationId).toBe('org-new');
        expect(result.roles).toEqual(['admin']);
        expect((result.permissions as string[]).sort()).toEqual(['*:read', '*:update']);
        expect((result as any).profileVersion).toBe(2);
    });
});
