import { OrganizationMember } from '@ottabase/ottaorm/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
const mockInvalidateUser = vi.fn();

vi.mock('@ottabase/auth/backend', () => ({
    getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@ottabase/rbac', () => ({
    getRBACCache: () => ({
        invalidateUser: mockInvalidateUser,
    }),
}));

vi.mock('../../lib/auth-utils', () => ({
    getAuthOptions: () => ({}),
}));

vi.mock('../../lib/db-utils', () => ({
    initDbConnection: vi.fn(),
}));

import { handleAccountSwitchOrg } from '../account-switch-org';

type KVStore = Map<string, string>;

function createKV(initial: Record<string, string> = {}): {
    kv: { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };
    store: KVStore;
} {
    const store: KVStore = new Map(Object.entries(initial));
    return {
        store,
        kv: {
            get: vi.fn(async (key: string) => store.get(key) ?? null),
            put: vi.fn(async (key: string, value: string) => {
                store.set(key, value);
            }),
        },
    };
}

function makeContext({ body, env }: { body?: unknown; env: Record<string, unknown> }): {
    request: Request;
    env: any;
    url: URL;
} {
    const request = new Request('http://localhost/api/account/switch-org', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { request, env: env as any, url: new URL(request.url) };
}

describe('handleAccountSwitchOrg', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 500 when D1 binding is missing', async () => {
        const response = await handleAccountSwitchOrg(makeContext({ body: {}, env: {} }));
        expect(response.status).toBe(500);
        const body = (await response.json()) as any;
        expect(body.code).toBe('CONFIG_ERROR');
    });

    it('returns 500 when KV binding is missing', async () => {
        const response = await handleAccountSwitchOrg(makeContext({ body: {}, env: { OBCF_D1: {} } }));
        expect(response.status).toBe(500);
        const body = (await response.json()) as any;
        expect(body.code).toBe('CONFIG_ERROR');
    });

    it('returns 401 when there is no session', async () => {
        mockGetSession.mockResolvedValue(null);
        const { kv } = createKV();

        const response = await handleAccountSwitchOrg(
            makeContext({ body: { organizationId: 'org-1' }, env: { OBCF_D1: {}, OBCF_KV: kv } }),
        );

        expect(response.status).toBe(401);
        const body = (await response.json()) as any;
        expect(body.code).toBe('UNAUTHENTICATED');
    });

    it('returns 400 when the body is not JSON', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
        const { kv } = createKV();

        const request = new Request('http://localhost/api/account/switch-org', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: 'not-json',
        });

        const response = await handleAccountSwitchOrg({
            request,
            env: { OBCF_D1: {}, OBCF_KV: kv } as any,
            url: new URL(request.url),
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as any;
        expect(body.code).toBe('BAD_REQUEST');
    });

    it('returns 400 when organizationId is missing', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
        const { kv } = createKV();

        const response = await handleAccountSwitchOrg(makeContext({ body: {}, env: { OBCF_D1: {}, OBCF_KV: kv } }));

        expect(response.status).toBe(400);
        const body = (await response.json()) as any;
        expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 403 when the user has no membership in the target org', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
        const { kv } = createKV();
        vi.spyOn(OrganizationMember, 'getMember').mockResolvedValue(undefined);

        const response = await handleAccountSwitchOrg(
            makeContext({
                body: { organizationId: 'org-99' },
                env: { OBCF_D1: {}, OBCF_KV: kv },
            }),
        );

        expect(response.status).toBe(403);
        const body = (await response.json()) as any;
        expect(body.code).toBe('FORBIDDEN');
        expect(mockInvalidateUser).not.toHaveBeenCalled();
    });

    it('returns 403 when the membership is not active', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
        const { kv } = createKV();
        vi.spyOn(OrganizationMember, 'getMember').mockResolvedValue({
            userId: 'user-1',
            organizationId: 'org-1',
            role: 'member',
            status: 'invited',
        } as any);

        const response = await handleAccountSwitchOrg(
            makeContext({
                body: { organizationId: 'org-1' },
                env: { OBCF_D1: {}, OBCF_KV: kv },
            }),
        );

        expect(response.status).toBe(403);
    });

    it('pins currentOrgId, bumps profile version, and invalidates RBAC on success', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
        const { kv, store } = createKV({ 'auth:usr:user-1:profile:version': '7' });
        vi.spyOn(OrganizationMember, 'getMember').mockResolvedValue({
            userId: 'user-1',
            organizationId: 'org-1',
            role: 'member',
            status: 'active',
        } as any);

        const response = await handleAccountSwitchOrg(
            makeContext({
                body: { organizationId: 'org-1' },
                env: { OBCF_D1: {}, OBCF_KV: kv },
            }),
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.data).toEqual({ organizationId: 'org-1' });

        const currentOrgId = Array.from(store.entries()).find(([k]) => k.endsWith(':profile:currentOrgId'));
        expect(currentOrgId?.[1]).toBe('org-1');

        const versionEntry = Array.from(store.entries()).find(([k]) => k.endsWith(':profile:version'));
        expect(versionEntry?.[1]).toBe('8');

        expect(mockInvalidateUser).toHaveBeenCalledWith('user-1', 'org-1');
    });

    it('initializes the profile version when no KV entry exists yet', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
        const { kv, store } = createKV();
        vi.spyOn(OrganizationMember, 'getMember').mockResolvedValue({
            userId: 'user-1',
            organizationId: 'org-1',
            role: 'owner',
            status: 'active',
        } as any);

        const response = await handleAccountSwitchOrg(
            makeContext({
                body: { organizationId: 'org-1' },
                env: { OBCF_D1: {}, OBCF_KV: kv },
            }),
        );

        expect(response.status).toBe(200);
        const versionEntry = Array.from(store.entries()).find(([k]) => k.endsWith(':profile:version'));
        expect(versionEntry?.[1]).toBe('1');
    });
});
