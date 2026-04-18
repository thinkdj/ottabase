import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdminTailWorkers } from '../admin-tail-workers';

vi.mock('../../lib/admin-guard', () => ({
    requireAdminAccess: vi.fn(),
}));

function createContext(envOverrides: Record<string, unknown> = {}) {
    const request = new Request('https://example.com/api/admin/tail-workers');
    return {
        request,
        env: {
            ...envOverrides,
        },
        url: new URL(request.url),
        route: '/api/admin/tail-workers',
        method: 'GET',
        withAuthCors: (response: Response) => response,
        corsHeaders: {},
    } as any;
}

describe('handleAdminTailWorkers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns auth response when admin access is denied', async () => {
        const { requireAdminAccess } = await import('../../lib/admin-guard');
        (requireAdminAccess as any).mockResolvedValue(new Response('forbidden', { status: 403 }));

        const response = await handleAdminTailWorkers(createContext());

        expect(response.status).toBe(403);
    });

    it('returns default worker tail commands when worker name is not provided', async () => {
        const { requireAdminAccess } = await import('../../lib/admin-guard');
        (requireAdminAccess as any).mockResolvedValue({ user: { id: 'admin-1' } });

        const response = await handleAdminTailWorkers(
            createContext({ ENVIRONMENT: 'production', NODE_ENV: 'production' }),
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.workerName).toBe('otta-web');
        expect(payload.tailCommands.basic).toBe('wrangler tail otta-web');
        expect(payload.tailCommands.json).toBe('wrangler tail otta-web --format json');
        expect(payload.logTargets).toHaveLength(3);
    });

    it('uses WORKER_NAME from env when provided', async () => {
        const { requireAdminAccess } = await import('../../lib/admin-guard');
        (requireAdminAccess as any).mockResolvedValue({ user: { id: 'admin-1' } });

        const response = await handleAdminTailWorkers(createContext({ WORKER_NAME: '  custom-worker  ' }));
        const payload = await response.json();

        expect(payload.workerName).toBe('custom-worker');
        expect(payload.tailCommands.basic).toBe('wrangler tail custom-worker');
    });
});
