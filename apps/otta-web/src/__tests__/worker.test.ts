import { getSession } from '@ottabase/auth/backend';
import { Account, User } from '@ottabase/ottaorm';
import { Shortlink } from '@ottabase/shortlinks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../cloudflare-worker';
import { APP_ID } from '../../ottabase/config.loader';

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
        it('should list shortlinks', async () => {
            // Mock D1 response for listing
            env.OBCF_D1.prepare.mockImplementation(() => createStatement([]));

            const resp = await worker.fetch(createRequest('/api/ottaorm/shortlinks'), env);
            expect(resp.status).toBe(200);
            const data = (await resp.json()) as any;
            expect(Array.isArray(data.data)).toBe(true);
            expect(data.pagination).toBeDefined();
            // Check handleCrud implementation, it returns `jsonResponse(result.data, result.status)`
            // If Model.currentDriver.list returns array, then it is array.
        });

        it('should create a shortlink', async () => {
            const payload = {
                fullUrl: 'https://google.com',
                shortCode: 'goog',
            };

            // Mock findByCode (return null = not found)
            // Then mock create (return success)
            // Since handleCrud uses the model, and we know Shortlink calls D1.

            // We need to carefully mock the D1 calls sequence or use a more sophisticated mock that retains state in memory?
            // For now simple mock:
            // 1. check unique (select ... where shortCode = ?) -> returns []
            // 2. insert -> returns success

            const shortlinkResult = new Shortlink({
                entity: Shortlink.entity,
                data: {
                    id: '1',
                    fullUrl: payload.fullUrl,
                    shortCode: payload.shortCode,
                    type: 'redirect',
                    appId: null,
                    expiryDate: null,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                },
            } as any);
            const createSpy = vi.spyOn(Shortlink, 'create').mockResolvedValue(shortlinkResult);

            const resp = await worker.fetch(createRequest('/api/ottaorm/shortlinks', 'POST', payload), env);

            // Note: The generic handleCrud might fail if mocks aren't perfect, but let's see.
            expect(resp.status).toBe(201);
            const data = (await resp.json()) as any;
            // Response format changed - now returns object directly, not wrapped
            expect(data.shortCode).toBe('goog');
            createSpy.mockRestore();
        });

        it('should find shortlink by field/value', async () => {
            const mockShortlink = {
                id: 'test-1',
                shortCode: 'test-code',
                fullUrl: 'https://example.com',
                type: 'redirect',
                appId: 'test',
                expiryDate: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            const shortlinkResult = new Shortlink({
                entity: Shortlink.entity,
                data: mockShortlink,
            } as any);

            const firstSpy = vi.spyOn(Shortlink, 'first').mockResolvedValue(shortlinkResult);
            vi.spyOn(shortlinkResult, 'toJson').mockReturnValue(mockShortlink);

            const resp = await worker.fetch(
                createRequest('/api/ottaorm/shortlinks?field=shortCode&value=test-code'),
                env,
            );

            expect(resp.status).toBe(200);
            const data = (await resp.json()) as any;
            // Response should be the object directly, not wrapped
            expect(data.shortCode).toBe('test-code');
            expect(data.id).toBe('test-1');
            expect(firstSpy).toHaveBeenCalledWith({ shortCode: 'test-code', appId: APP_ID });

            firstSpy.mockRestore();
        });

        it('should return 404 when shortlink not found by field/value', async () => {
            const firstSpy = vi.spyOn(Shortlink, 'first').mockResolvedValue(null);

            const resp = await worker.fetch(
                createRequest('/api/ottaorm/shortlinks?field=shortCode&value=non-existent'),
                env,
            );

            expect(resp.status).toBe(404);
            const data = (await resp.json()) as any;
            expect(data.error).toContain('not found');
            expect(firstSpy).toHaveBeenCalledWith({ shortCode: 'non-existent', appId: APP_ID });

            firstSpy.mockRestore();
        });
    });

    describe('Legacy /api/shortlinks', () => {
        it('should list shortlinks (paginated)', async () => {
            // Legacy endpoint returns paginated response structure
            env.OBCF_D1.prepare.mockImplementation(() => createStatement([]));

            const resp = await worker.fetch(createRequest('/api/shortlinks'), env);
            expect(resp.status).toBe(200);
            const data = (await resp.json()) as any;
            expect(data.data).toBeDefined();
            expect(data.pagination?.total).toBeDefined();
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
