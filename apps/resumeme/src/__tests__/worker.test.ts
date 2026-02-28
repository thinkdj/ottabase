import { getSession } from '@ottabase/auth/backend';
import { Account, User } from '@ottabase/ottaorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../cloudflare-worker';

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
            expect(data.name).toBe('resumeme');
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
});
