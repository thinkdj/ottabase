import { afterEach, describe, expect, it, vi } from 'vitest';
import { changePassword, getSession } from '../client-api';

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
            user: { id: 'user-1', email: 'test@example.com' },
            expires: expect.any(Number),
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
            user: { id: 'user-2', email: 'warm@example.com' },
            expires: expect.any(Number),
        });
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
