import { describe, expect, it, vi } from 'vitest';
import { createAuthConfig } from '../backend-handler';

function createD1WithMembership(hasMembership: boolean) {
    const prepare = vi.fn((sql: string) => {
        const stub: any = {
            first: vi.fn(async () => null),
            all: vi.fn(async () => ({ results: [] })),
            run: vi.fn(async () => ({ success: true })),
        };
        if (sql.includes('FROM organization_members WHERE user_id')) {
            stub.first = vi.fn(async () => (hasMembership ? { '1': 1 } : null));
        }
        if (sql.toLowerCase().includes('update users set email_verified')) {
            stub.run = vi.fn(async () => ({ success: true }));
        }
        stub.bind = vi.fn(() => stub);
        return stub;
    });
    return { prepare };
}

describe('createAuthConfig — onFirstSignIn hook', () => {
    it('invokes the hook when the user has no existing membership', async () => {
        const d1 = createD1WithMembership(false);
        const env = {
            OBCF_D1: d1 as any,
            AUTH_SECRET: 'test-secret',
            ENVIRONMENT: 'test',
        };
        const onFirstSignIn = vi.fn(async () => undefined);

        const config = createAuthConfig(env as any, { onFirstSignIn });
        const signIn = config.callbacks?.signIn!;

        const result = await signIn({
            user: { id: 'user-1', email: 'new@example.com' },
            account: { provider: 'credentials' },
        } as any);

        expect(result).toBe(true);
        expect(onFirstSignIn).toHaveBeenCalledTimes(1);
        expect(onFirstSignIn).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), env);
    });

    it('does NOT re-invoke the hook for returning users with existing membership', async () => {
        const d1 = createD1WithMembership(true);
        const env = {
            OBCF_D1: d1 as any,
            AUTH_SECRET: 'test-secret',
            ENVIRONMENT: 'test',
        };
        const onFirstSignIn = vi.fn(async () => undefined);

        const config = createAuthConfig(env as any, { onFirstSignIn });
        const signIn = config.callbacks?.signIn!;

        await signIn({
            user: { id: 'user-1', email: 'returning@example.com' },
            account: { provider: 'credentials' },
        } as any);

        expect(onFirstSignIn).not.toHaveBeenCalled();
    });

    it('swallows errors from the hook to preserve sign-in', async () => {
        const d1 = createD1WithMembership(false);
        const env = {
            OBCF_D1: d1 as any,
            AUTH_SECRET: 'test-secret',
            ENVIRONMENT: 'test',
        };
        const onFirstSignIn = vi.fn(async () => {
            throw new Error('hook blew up');
        });

        const config = createAuthConfig(env as any, { onFirstSignIn });
        const signIn = config.callbacks?.signIn!;
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const result = await signIn({
            user: { id: 'user-1', email: 'x@e.co' },
            account: { provider: 'credentials' },
        } as any);

        expect(result).toBe(true);
        expect(onFirstSignIn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('also invokes onSignIn after onFirstSignIn', async () => {
        const d1 = createD1WithMembership(false);
        const env = {
            OBCF_D1: d1 as any,
            AUTH_SECRET: 'test-secret',
            ENVIRONMENT: 'test',
        };
        const order: string[] = [];
        const onFirstSignIn = vi.fn(async () => {
            order.push('first');
        });
        const onSignIn = vi.fn(async () => {
            order.push('signin');
        });

        const config = createAuthConfig(env as any, { onFirstSignIn, onSignIn });
        const signIn = config.callbacks?.signIn!;

        await signIn({
            user: { id: 'user-1', email: 'x@e.co' },
            account: { provider: 'google' },
        } as any);

        expect(order).toEqual(['first', 'signin']);
        expect(onSignIn).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'user-1' }),
            env,
            expect.objectContaining({ provider: 'google' }),
        );
    });
});
