import { Router } from '@ottabase/ottarouter';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The model is the one thing this suite does not exercise for real: an in-memory table
// behind the same static calls the routes make. `vi.mock` is hoisted above the imports.
const rows: Array<Record<string, unknown>> = [];
vi.mock('../ottaorm-models/FlagOverride', async () => {
    const actual = await vi.importActual<typeof import('../ottaorm-models/FlagOverride')>(
        '../ottaorm-models/FlagOverride',
    );
    const { DomainValidationError } = await vi.importActual<typeof import('@ottabase/ottaorm')>('@ottabase/ottaorm');
    class FakeFlagOverride extends actual.FlagOverride {
        static override async where(where: Record<string, unknown>): Promise<any> {
            return rows
                .filter((row) => Object.entries(where).every(([key, value]) => (row[key] ?? null) === (value ?? null)))
                .map((row) => new FakeFlagOverride({ entity: 'flag_overrides', data: { ...row } }));
        }
        static override async first(where: Record<string, unknown>): Promise<any> {
            return (await this.where(where))[0] ?? null;
        }
        static override async create(data: Record<string, unknown>): Promise<any> {
            const key = String(data.key ?? '');
            if (!/^(plan|feature:[a-z][a-z0-9._-]*|limit:[a-z][a-z0-9._-]*)$/i.test(key)) {
                throw new DomainValidationError('Override key must be "plan", "feature:<id>" or "limit:<id>"', {
                    code: 'INVALID_OVERRIDE',
                });
            }
            const row = {
                id: `o-${rows.length + 1}`,
                ...data,
                scope: actual.overrideScope(
                    (data.organizationId as string | null) ?? null,
                    (data.userId as string | null) ?? null,
                ),
                value: actual.encodeOverrideValue(key, data.value),
                createdAt: Date.now(),
            };
            rows.push(row);
            return new FakeFlagOverride({ entity: 'flag_overrides', data: { ...row } });
        }
        static override async delete(id: string | number): Promise<boolean> {
            const index = rows.findIndex((row) => row.id === id);
            if (index >= 0) rows.splice(index, 1);
            return index >= 0;
        }
    }
    return { ...actual, FlagOverride: FakeFlagOverride };
});

import { createFlags, createFlagsPackage, createFlagsRouter, type FlagsCaller } from '../index';
import { createPackageRegistry, mountPackages } from '@ottabase/kernel';

type Env = Record<string, unknown>;
let caller: FlagsCaller | null = null;

function app() {
    const flags = createFlags<Env>({
        plans: { free: { limits: { projects: 2 } }, pro: { features: ['export'] } },
        defaultPlan: 'free',
        cacheTtlMs: 0,
    });
    const router = createFlagsRouter<Env>({ flags, resolveCaller: async () => caller });
    return { flags, router };
}

const request = (path: string, init?: RequestInit) => new Request(`https://app.test${path}`, init);
const json = (body: unknown) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
});

describe('flags routes', () => {
    beforeEach(() => {
        rows.length = 0;
        caller = { appId: 'app', organizationId: 'org-1', userId: 'u-1' };
    });

    it("GET /me returns the caller's entitlements, 401 when anonymous", async () => {
        const { router } = app();
        const ok = await router.handle(request('/me'), {});
        expect(ok?.status).toBe(200);
        expect(((await ok!.json()) as { data: { plan: string } }).data.plan).toBe('free');

        caller = null;
        expect((await router.handle(request('/me'), {}))?.status).toBe(401);
    });

    it('overrides are platform-admin only, validated, and change /me immediately', async () => {
        const { router } = app();
        expect((await router.handle(request('/overrides', json({ key: 'plan', value: 'pro' })), {}))?.status).toBe(403);

        caller = { appId: 'app', organizationId: 'org-1', userId: 'admin', platformAdmin: true };
        const bad = await router.handle(request('/overrides', json({ key: 'nonsense', value: 1 })), {});
        expect(bad?.status).toBe(400);

        const created = await router.handle(
            request('/overrides', json({ organizationId: 'org-1', key: 'plan', value: 'pro', reason: 'comp' })),
            {},
        );
        expect(created?.status).toBe(201);
        const id = ((await created!.json()) as { data: { id: string } }).data.id;

        caller = { appId: 'app', organizationId: 'org-1', userId: 'u-1' };
        const me = (await (await router.handle(request('/me'), {}))!.json()) as {
            data: { plan: string; applied: unknown[] };
        };
        expect(me.data.plan).toBe('pro');
        expect(me.data.applied).toHaveLength(1);

        caller = { appId: 'app', organizationId: 'org-1', userId: 'admin', platformAdmin: true };
        const listed = (await (await router.handle(request('/overrides?organizationId=org-1'), {}))!.json()) as {
            data: unknown[];
        };
        expect(listed.data).toHaveLength(1);
        expect((await router.handle(request(`/overrides/${id}`, { method: 'DELETE' }), {}))?.status).toBe(200);
        expect((await router.handle(request(`/overrides/${id}`, { method: 'DELETE' }), {}))?.status).toBe(404);
    });

    it('is a kernel package: table, model, policy and the mounted route', async () => {
        const { flags } = app();
        const pkg = createFlagsPackage<Env>({ flags, resolveCaller: async () => caller });
        expect(Object.keys(pkg.tables!)).toEqual(['flagOverridesTable']);
        expect(pkg.policies?.[0].model).toBe('flag_overrides');
        const router = new Router<Env>();
        expect(mountPackages(router, { packages: createPackageRegistry({ packages: [pkg] }) })).toEqual(['/api/flags']);
        expect((await router.handle(request('/api/flags/me'), {}))?.status).toBe(200);
    });
});
