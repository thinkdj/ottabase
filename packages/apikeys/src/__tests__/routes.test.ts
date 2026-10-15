import { createPackageRegistry, mountPackages } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rows: Array<Record<string, unknown>> = [];
vi.mock('../ottaorm-models/ApiKey', async () => {
    const actual = await vi.importActual<typeof import('../ottaorm-models/ApiKey')>('../ottaorm-models/ApiKey');
    const wrap = (row: Record<string, unknown>) => new FakeApiKey({ entity: 'api_keys', data: { ...row } });
    class FakeApiKey extends actual.ApiKey {
        static override async where(where: Record<string, unknown>): Promise<any> {
            return rows
                .filter((row) => Object.entries(where).every(([key, value]) => (row[key] ?? null) === (value ?? null)))
                .map(wrap);
        }
        static override async first(where: Record<string, unknown>): Promise<any> {
            return (await this.where(where))[0] ?? null;
        }
        static override async create(data: Record<string, unknown>): Promise<any> {
            const row = {
                id: `k-${rows.length + 1}`,
                lastUsedAt: null,
                revokedAt: null,
                createdAt: Date.now(),
                ...data,
            };
            rows.push(row);
            return wrap(row);
        }
        static override async update(id: string | number, data: Record<string, unknown>): Promise<any> {
            const row = rows.find((entry) => entry.id === id);
            if (row) Object.assign(row, data);
            return row ? wrap(row) : null;
        }
    }
    return { ...actual, ApiKey: FakeApiKey };
});

import { createApiKeys, createApiKeysPackage, createApiKeysRouter, type ApiKeysCaller } from '../index';

type Env = Record<string, never>;
const env: Env = {};
let caller: ApiKeysCaller | null = null;
const request = (path: string, init?: RequestInit) => new Request(`https://app.test${path}`, init);
const post = (body: unknown) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
});
const data = async <T>(response: Response | null) => ((await response!.json()) as { data: T }).data;

describe('api keys routes', () => {
    beforeEach(() => {
        rows.length = 0;
        caller = { appId: 'app', organizationId: 'org-1', userId: 'u-1', canManage: false };
    });

    it('a member issues, lists and revokes personal keys; the plaintext is returned once', async () => {
        const keys = createApiKeys<Env>();
        const router = createApiKeysRouter<Env>({
            keys,
            resolveCaller: async () => caller,
            allowedScopes: ['read', 'write'],
        });

        expect((await router.handle(request('/', post({ name: 'CI', scopes: ['admin'] })), env))?.status).toBe(400);
        const created = await router.handle(request('/', post({ name: 'CI', scopes: ['read'] })), env);
        expect(created?.status).toBe(201);
        const issued = await data<{ key: string; record: { id: string } }>(created);
        expect(issued.key).toMatch(/^ok_live_/);

        const listed = await data<Array<Record<string, unknown>>>(await router.handle(request('/'), env));
        expect(listed).toHaveLength(1);
        expect(JSON.stringify(listed)).not.toContain(issued.key.slice(16));

        expect((await router.handle(request(`/${issued.record.id}`, { method: 'DELETE' }), env))?.status).toBe(200);
        expect((await router.handle(request('/nope', { method: 'DELETE' }), env))?.status).toBe(404);
        expect(await keys.verify(env, issued.key)).toMatchObject({ ok: false, reason: 'REVOKED' });

        caller = null;
        expect((await router.handle(request('/'), env))?.status).toBe(401);
    });

    it('organization keys need a manager, and are verified back to the organization', async () => {
        const keys = createApiKeys<Env>();
        const router = createApiKeysRouter<Env>({ keys, resolveCaller: async () => caller });
        expect((await router.handle(request('/', post({ name: 'svc', scope: 'organization' })), env))?.status).toBe(
            403,
        );

        caller = { ...caller!, canManage: true };
        const issued = await data<{ key: string }>(
            await router.handle(request('/', post({ name: 'svc', scope: 'organization' })), env),
        );
        expect(await keys.verify(env, issued.key)).toMatchObject({
            ok: true,
            subject: { organizationId: 'org-1', userId: null },
        });
        expect(await data<unknown[]>(await router.handle(request('/?scope=organization'), env))).toHaveLength(1);
        expect(await data<unknown[]>(await router.handle(request('/'), env))).toHaveLength(0);
    });

    it('is a kernel package with its table, model, policy and mounted routes', async () => {
        const keys = createApiKeys<Env>();
        const pkg = createApiKeysPackage<Env>({ keys, resolveCaller: async () => caller });
        expect(Object.keys(pkg.tables!)).toEqual(['apiKeysTable']);
        expect(pkg.policies?.[0].model).toBe('api_keys');
        const router = new Router<Env>();
        expect(mountPackages(router, { packages: createPackageRegistry({ packages: [pkg] }) })).toEqual(['/api/keys']);
        expect((await router.handle(request('/api/keys'), env))?.status).toBe(200);
    });
});
