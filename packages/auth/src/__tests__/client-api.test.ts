import { afterEach, describe, expect, it, vi } from 'vitest';
import { changePassword, getCsrfToken, getSession, signInWithCredentials, signOut } from '../client-api';

describe('client-api changePassword', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('returns success when API responds 200', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: true,
            })) as unknown as typeof fetch,
        );

        const result = await changePassword({
            currentPassword: 'Current@123',
            newPassword: 'NewPassword@123',
        });

        expect(result).toEqual({ success: true });
        expect(fetch).toHaveBeenCalledWith('/api/auth/password/change', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                currentPassword: 'Current@123',
                newPassword: 'NewPassword@123',
            }),
        });
    });

    it('returns API error message when request fails', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: false,
                json: async () => ({ error: 'Current password is incorrect' }),
            })) as unknown as typeof fetch,
        );

        const result = await changePassword({
            currentPassword: 'Wrong@123',
            newPassword: 'NewPassword@123',
        });

        expect(result).toEqual({
            success: false,
            error: 'Current password is incorrect',
        });
    });

    it('returns generic error when fetch throws', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('Network down');
            }) as unknown as typeof fetch,
        );

        const result = await changePassword({
            currentPassword: 'Current@123',
            newPassword: 'NewPassword@123',
        });

        expect(result).toEqual({
            success: false,
            error: 'Network down',
        });
    });

    it('retries getSession after a transient network failure', async () => {
        vi.useFakeTimers();
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockRejectedValueOnce(new Error('temporary network failure'))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        user: { id: 'user-1', email: 'test@example.com' },
                        expires: Date.now() + 1000,
                    }),
                }) as unknown as typeof fetch,
        );

        const sessionPromise = getSession();
        await vi.runAllTimersAsync();

        await expect(sessionPromise).resolves.toEqual({
            state: 'authenticated',
            session: {
                user: { id: 'user-1', email: 'test@example.com' },
                expires: expect.any(Number),
            },
        });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('retries getSession after a transient 503 response', async () => {
        vi.useFakeTimers();
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 503,
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        user: { id: 'user-2', email: 'warm@example.com' },
                        expires: Date.now() + 1000,
                    }),
                }) as unknown as typeof fetch,
        );

        const sessionPromise = getSession();
        await vi.runAllTimersAsync();

        await expect(sessionPromise).resolves.toEqual({
            state: 'authenticated',
            session: {
                user: { id: 'user-2', email: 'warm@example.com' },
                expires: expect.any(Number),
            },
        });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('returns anonymous only for an explicit empty session', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => null })) as unknown as typeof fetch);

        await expect(getSession()).resolves.toEqual({ state: 'anonymous' });
    });

    it('treats a malformed 200 response as unavailable, not anonymous', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: true,
                json: async () => ({ user: { id: 'user-1' }, expires: 'tomorrow' }),
            })) as unknown as typeof fetch,
        );

        await expect(getSession()).resolves.toEqual({
            state: 'unavailable',
            reason: 'invalid-response',
            message: 'Session endpoint returned an invalid session',
        });
    });

    it('distinguishes an unavailable auth service from an anonymous session', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })) as unknown as typeof fetch);

        const sessionPromise = getSession();
        await vi.runAllTimersAsync();

        await expect(sessionPromise).resolves.toEqual({
            state: 'unavailable',
            reason: 'server',
            message: 'Session endpoint returned HTTP 503',
            httpStatus: 503,
        });
    });

    it('treats a 401 as anonymous without retrying', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch);

        await expect(getSession()).resolves.toEqual({ state: 'anonymous' });
        expect(fetch).toHaveBeenCalledOnce();
    });
});

describe('getCsrfToken', () => {
    afterEach(() => vi.restoreAllMocks());

    it('returns the token from the JSON body', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({ ok: true, json: async () => ({ csrfToken: 'abc123' }) })) as unknown as typeof fetch,
        );

        await expect(getCsrfToken()).resolves.toBe('abc123');
        expect(fetch).toHaveBeenCalledWith('/api/auth/csrf', { credentials: 'include' });
    });

    it('returns null on a non-ok response', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })) as unknown as typeof fetch);
        await expect(getCsrfToken()).resolves.toBeNull();
    });
});

describe('signInWithCredentials', () => {
    afterEach(() => vi.restoreAllMocks());

    it('fetches a CSRF token, then posts JSON credentials including it', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'csrf-token-value' }) })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    session: { user: { id: 'user-1', email: 'user@example.com' }, expires: Date.now() + 1000 },
                }),
            });
        vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

        const result = await signInWithCredentials({ email: 'user@example.com', password: 'Password1!' });

        expect(result.success).toBe(true);
        expect(result.session?.user.id).toBe('user-1');

        const [, callArgs] = fetchMock.mock.calls[1] as [string, RequestInit];
        expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/callback/credentials');
        expect(JSON.parse(callArgs.body as string)).toEqual({
            email: 'user@example.com',
            password: 'Password1!',
            csrfToken: 'csrf-token-value',
        });
    });

    it('surfaces the server error message on failure', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'csrf-token-value' }) })
                .mockResolvedValueOnce({
                    ok: false,
                    json: async () => ({ error: 'Invalid email or password' }),
                }) as unknown as typeof fetch,
        );

        const result = await signInWithCredentials({ email: 'user@example.com', password: 'wrong' });
        expect(result).toEqual({ success: false, error: 'Invalid email or password' });
    });
});

describe('signOut', () => {
    afterEach(() => vi.restoreAllMocks());

    it('posts a CSRF-protected sign-out request', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'csrf-token-value' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
        vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

        const result = await signOut();

        expect(result).toEqual({ success: true });
        expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/signout');
    });
});
