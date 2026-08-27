import { getSession } from '@ottabase/auth/backend';
import { Account, User } from '@ottabase/ottaorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import workerHandler from '../../cloudflare-worker';

const worker = {
    fetch(request: Request, env: CloudflareEnv) {
        const ctx = {
            waitUntil: vi.fn(),
            passThroughOnException: vi.fn(),
        } as unknown as ExecutionContext;
        return workerHandler.fetch!(request, env, ctx);
    },
};

vi.mock('@ottabase/auth/backend', async () => {
    const actual = await vi.importActual<any>('@ottabase/auth/backend');
    return {
        ...actual,
        getSession: vi.fn(),
    };
});

// Helper to create a mock request
function createRequest(path: string, method = 'GET', body?: any) {
    return new Request(`http://localhost${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
}

describe('Cloudflare Worker API', () => {
    let env: any;
    const toRawRows = (rows: any[]) => rows.map((row) => Object.values(row));
    const createStatement = (rawResult: any[]) => ({
        bind: vi.fn().mockReturnThis(),
        raw: vi.fn().mockResolvedValue(toRawRows(rawResult)),
        all: vi.fn().mockResolvedValue({ results: rawResult, success: true }),
        first: vi.fn().mockResolvedValue(rawResult[0] ?? null),
        run: vi.fn().mockResolvedValue({
            success: true,
            meta: { changes: rawResult.length },
        }),
    });

    beforeEach(() => {
        env = {
            OBCF_D1: (global as any).OBCF_D1,
            OBCF_KV: (global as any).OBCF_KV,
            OBCF_R2: (global as any).OBCF_R2,
            OBCF_QUEUE: (global as any).OBCF_QUEUE,
            ENVIRONMENT: 'test',
        };
        vi.clearAllMocks();

        // Default mock setup for D1
        env.OBCF_D1.prepare.mockImplementation(() => createStatement([]));
    });

    describe('/api/health', () => {
        it('should return health check', async () => {
            const resp = await worker.fetch(createRequest('/api/health'), env);
            const data = (await resp.json()) as any;
            expect(resp.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(data.name).toBe('otta-web');
        });
    });

    describe('/api/users/me', () => {
        let accountForUserSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            accountForUserSpy = vi.spyOn(Account, 'forUser').mockResolvedValue([
                {
                    toJson: () => ({
                        provider: 'google',
                        type: 'oauth',
                        createdAt: Date.parse('2026-01-01T00:00:00Z'),
                    }),
                } as any,
            ]);
        });

        afterEach(() => {
            accountForUserSpy.mockRestore();
        });

        it('should return current user', async () => {
            const userJson = { id: 'user-1', name: 'Ada', email: 'ada@example.com' };
            (getSession as any).mockResolvedValue({ user: { id: 'user-1' } });
            const findSpy = vi.spyOn(User, 'find').mockResolvedValue({
                toJson: () => userJson,
            } as any);

            const resp = await worker.fetch(createRequest('/api/users/me'), env);
            expect(resp.status).toBe(200);
            const data = (await resp.json()) as any;
            expect(data).toMatchObject(userJson);
            expect(Array.isArray(data.linkedAccounts)).toBe(true);

            findSpy.mockRestore();
        });

        it('should validate updates', async () => {
            (getSession as any).mockResolvedValue({ user: { id: 'user-1' } });

            const resp = await worker.fetch(createRequest('/api/users/me', 'PATCH', { name: ' ' }), env);
            expect(resp.status).toBe(400);
            const data = (await resp.json()) as any;
            expect(data.code).toBe('VALIDATION_ERROR');
            expect(data.fieldErrors?.name).toBeDefined();
        });

        it('should update allowed fields', async () => {
            const userJson = { id: 'user-1', name: 'Ada Lovelace', email: 'ada@example.com', image: null };
            (getSession as any).mockResolvedValue({ user: { id: 'user-1' } });
            const updateSpy = vi.spyOn(User, 'update').mockResolvedValue({
                toJson: () => userJson,
            } as any);

            const resp = await worker.fetch(createRequest('/api/users/me', 'PATCH', { name: 'Ada Lovelace' }), env);
            expect(resp.status).toBe(200);
            const data = (await resp.json()) as any;
            expect(data.name).toBe('Ada Lovelace');
            expect(data.linkedAccounts?.[0]?.provider).toBe('google');

            updateSpy.mockRestore();
        });

        it('should allow removing profile image with image: null', async () => {
            const userJson = { id: 'user-1', name: 'Ada', email: 'ada@example.com', image: null };
            (getSession as any).mockResolvedValue({ user: { id: 'user-1' } });
            const updateSpy = vi.spyOn(User, 'update').mockResolvedValue({
                toJson: () => userJson,
            } as any);

            const resp = await worker.fetch(createRequest('/api/users/me', 'PATCH', { image: null }), env);
            expect(resp.status).toBe(200);
            const data = (await resp.json()) as any;
            expect(data.image).toBeNull();
            expect(updateSpy).toHaveBeenCalledWith('user-1', expect.objectContaining({ image: null }));

            updateSpy.mockRestore();
        });
    });

    describe('/api/ottaorm/users', () => {
        it('should be disabled', async () => {
            (getSession as any).mockResolvedValue({ user: { id: 'user-1' } });

            const resp = await worker.fetch(createRequest('/api/ottaorm/users/user-1'), env);
            expect(resp.status).toBe(403);
            const data = (await resp.json()) as any;
            expect(data.code).toBe('CRUD_DISABLED');
        });
    });

    describe('/api/ottaorm/shortlinks', () => {
        // The generic CRUD route is fully disabled for shortlinks (like users/menus/
        // organization_members). The shortlinks RLS policy is platform-admin gated
        // (requirePlatformAdmin), and the hard-block additionally routes all management through
        // /api/shortlinks, which gates on requireAdminAccess({ scope: 'system' }) and owns
        // analytics/slug handling — see 'Legacy /api/shortlinks' below.
        it('should be disabled, even for an authenticated admin session', async () => {
            (getSession as any).mockResolvedValue({ user: { id: 'admin-1', roles: ['admin'] } });

            const resp = await worker.fetch(createRequest('/api/ottaorm/shortlinks'), env);
            expect(resp.status).toBe(403);
            const data = (await resp.json()) as any;
            expect(data.code).toBe('CRUD_DISABLED');
        });

        it('rejects anonymous requests', async () => {
            (getSession as any).mockResolvedValue(null);

            const resp = await worker.fetch(createRequest('/api/ottaorm/shortlinks'), env);
            expect(resp.status).toBe(403);
            const data = (await resp.json()) as any;
            expect(data.code).toBe('CRUD_DISABLED');
        });
    });

    describe('Legacy /api/shortlinks', () => {
        it('rejects unauthenticated requests (admin-only management endpoint)', async () => {
            // Anyone could once list/create/edit every shortlink; the endpoint now requires
            // an authenticated admin session (see requireAdminAccess in worker/routes/shortlinks.ts).
            env.OBCF_D1.prepare.mockImplementation(() => createStatement([]));
            (getSession as any).mockResolvedValue(null);

            const resp = await worker.fetch(createRequest('/api/shortlinks'), env);
            expect(resp.status).toBe(401);
        });
    });

    describe('/api/demo', () => {
        it('should handle GET', async () => {
            const resp = await worker.fetch(createRequest('/api/demo'), env);
            const data = (await resp.json()) as any;
            expect(data.message).toBe('Hello from GET');
        });

        it('should handle POST', async () => {
            const resp = await worker.fetch(createRequest('/api/demo', 'POST', { name: 'Test' }), env);
            const data = (await resp.json()) as any;
            expect(data.message).toBe('Hello, Test!');
        });
    });
});
