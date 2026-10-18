import { Router } from '@ottabase/ottarouter';
import { describe, expect, it, vi } from 'vitest';
import {
    applyPackageLifecycle,
    createMemoryInstallStore,
    createPackageRegistry,
    definePackage,
    mountPackages,
    runHealth,
    type ModelEntry,
    type OttaPackage,
} from '../index';

type Env = { OBCF_D1?: unknown; SECRET?: string };

const usersTable = { name: 'users' };
const notesTable = { name: 'notes' };

function pkg(overrides: Partial<OttaPackage<Env>> & { key: string }): OttaPackage<Env> {
    return definePackage<Env>({ name: overrides.key, version: '1.0.0', ...overrides });
}

describe('definePackage', () => {
    it('rejects a bad key, a missing name or version, and malformed contributions', () => {
        expect(() => definePackage({ key: 'Bad Key', name: 'x', version: '1' })).toThrow(/Invalid package key/);
        expect(() => definePackage({ key: 'ok', name: ' ', version: '1' })).toThrow(/display name/);
        expect(() => definePackage({ key: 'ok', name: 'x', version: '' })).toThrow(/version/);
        expect(() =>
            definePackage({
                key: 'ok',
                name: 'x',
                version: '1',
                routes: { basePath: 'api', build: () => new Router() },
            }),
        ).toThrow(/basePath must start with/);
        expect(() => definePackage({ key: 'ok', name: 'x', version: '1', tables: { users: usersTable } })).toThrow(
            /must end in "Table"/,
        );
        expect(() =>
            definePackage({
                key: 'ok',
                name: 'x',
                version: '1',
                cron: { tick: { description: '', handler: () => {} } },
            }),
        ).toThrow(/needs a description/);
        expect(() =>
            definePackage({
                key: 'ok',
                name: 'x',
                version: '1',
                nav: [{ title: 't', description: 'd', href: 'admin/x' }],
            }),
        ).toThrow(/nav href/);
    });

    it('returns the manifest unchanged when it is well-formed', () => {
        const manifest = { key: 'notes', name: 'Notes', version: '2.1.0', tables: { notesTable } };
        expect(definePackage(manifest)).toBe(manifest);
    });
});

describe('createPackageRegistry', () => {
    it('collects every contribution, tagged with its package where that matters', () => {
        const model = class Note {} as unknown as ModelEntry;
        const policy = { model: 'notes', policy: {} as never };
        const migration = { name: '001', up: async () => {} };
        const handler = () => {};
        const registry = createPackageRegistry<Env>({
            packages: [
                pkg({
                    key: 'notes',
                    tables: { notesTable },
                    migrations: [migration],
                    suppressIndexes: ['notes_unique_slug'],
                    models: [model],
                    policies: [policy],
                    routes: [{ basePath: '/api/notes', build: () => new Router() }],
                    cron: { 'notes:purge': { description: 'purge', handler, schedule: '0 3 * * *' } },
                    queue: { 'notes:index': () => {} },
                    events: [{ event: 'user.created', handler }],
                    nav: [{ title: 'Notes', description: 'd', href: '/admin/content/notes', group: 'content' }],
                    env: { required: ['OBCF_D1'], optional: ['SECRET'] },
                }),
                pkg({ key: 'users', tables: { usersTable }, env: { required: ['OBCF_D1'] } }),
            ],
        });

        expect(registry.keys()).toEqual(['notes', 'users']);
        expect(registry.has('notes')).toBe(true);
        expect(registry.get('nope')).toBeNull();
        expect(registry.installed()).toEqual({ notes: true, users: true });
        expect(registry.tables()).toEqual({ notesTable, usersTable });
        expect(registry.migrations()).toEqual([migration]);
        expect(registry.suppressIndexes()).toEqual(['notes_unique_slug']);
        expect(registry.models()).toEqual([model]);
        expect(registry.policies()).toEqual([policy]);
        expect(registry.routes().map((r) => [r.packageKey, r.basePath])).toEqual([['notes', '/api/notes']]);
        expect(registry.cron()['notes:purge']).toMatchObject({ packageKey: 'notes', schedule: '0 3 * * *' });
        expect(Object.keys(registry.queue())).toEqual(['notes:index']);
        expect(registry.events()).toHaveLength(1);
        expect(registry.nav()).toEqual([
            expect.objectContaining({ packageKey: 'notes', href: '/admin/content/notes' }),
        ]);
        expect(registry.env()).toEqual({ required: ['OBCF_D1'], optional: ['SECRET'] });
    });

    it('hands an incident to every error reporter, under waitUntil, and survives a reporter that throws', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const seen: string[] = [];
        const kept: Promise<unknown>[] = [];
        const registry = createPackageRegistry<Env>({
            packages: [
                pkg({
                    key: 'tracker',
                    errors: { report: async (incident) => void seen.push(`tracker:${incident.source}`) },
                }),
                pkg({
                    key: 'pager',
                    errors: {
                        report: () => {
                            throw new Error('pager down');
                        },
                    },
                }),
                pkg({ key: 'quiet' }),
            ],
        });
        registry.report({
            error: new Error('boom'),
            env: {},
            source: 'cron',
            task: 'notes:purge',
            waitUntil: (p) => void kept.push(p),
        });
        await Promise.all(kept);
        expect(seen).toEqual(['tracker:cron']);
        expect(kept).toHaveLength(2);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('pager error reporter failed: pager down'));
        warn.mockRestore();
    });

    it('throws at boot on duplicate keys, table names, cron names and queue job types', () => {
        expect(() => createPackageRegistry({ packages: [pkg({ key: 'alpha' }), pkg({ key: 'alpha' })] })).toThrow(
            /Duplicate package key "alpha"/,
        );
        expect(() =>
            createPackageRegistry({
                packages: [pkg({ key: 'alpha', tables: { usersTable } }), pkg({ key: 'beta', tables: { usersTable } })],
            }),
        ).toThrow(/Table "usersTable" is contributed by both "alpha" and "beta"/);
        const job = { description: 'd', handler: () => {} };
        expect(() =>
            createPackageRegistry({
                packages: [pkg({ key: 'alpha', cron: { tick: job } }), pkg({ key: 'beta', cron: { tick: job } })],
            }),
        ).toThrow(/Cron handler "tick"/);
        expect(() =>
            createPackageRegistry({
                packages: [
                    pkg({ key: 'alpha', queue: { mail: () => {} } }),
                    pkg({ key: 'beta', queue: { mail: () => {} } }),
                ],
            }),
        ).toThrow(/Queue job type "mail"/);
    });

    it('returns copies, so a caller cannot mutate the registry through them', () => {
        const registry = createPackageRegistry<Env>({ packages: [pkg({ key: 'alpha', tables: { usersTable } })] });
        const tables = registry.tables();
        delete tables.usersTable;
        expect(registry.tables()).toEqual({ usersTable });
    });
});

describe('mountPackages', () => {
    async function call(router: Router<Env>, path: string, env: Env = {}) {
        return router.handle(new Request(`https://x.test${path}`), env);
    }

    it('mounts free packages with their gate and middleware, hands build() the host, skips premium', async () => {
        const before = vi.fn(async (_c: unknown, next: () => Promise<Response | null>) => next());
        let seenHost: unknown = null;
        const registry = createPackageRegistry<Env>({
            packages: [
                pkg({
                    key: 'notes',
                    routes: {
                        basePath: '/api/notes',
                        before,
                        when: (c) => c.env.SECRET === 'on',
                        build: (host) => {
                            seenHost = host;
                            return new Router<Env>().get('/', () => Response.json({ notes: true }));
                        },
                    },
                }),
                pkg({
                    key: 'paid',
                    premium: true,
                    routes: { basePath: '/api/paid', build: () => new Router<Env>().get('/', () => Response.json({})) },
                }),
            ],
        });
        const router = new Router<Env>();
        const host = { packages: registry };
        expect(mountPackages(router, host)).toEqual(['/api/notes']);
        expect(seenHost).toBe(host);

        const open = await call(router, '/api/notes', { SECRET: 'on' });
        expect(await open?.json()).toEqual({ notes: true });
        expect(before).toHaveBeenCalled();

        expect(await call(router, '/api/notes', { SECRET: 'off' })).toBeNull();
        expect(await call(router, '/api/paid')).toBeNull();
    });
});

describe('runHealth', () => {
    it('reports missing required env and isolates a throwing probe', async () => {
        const registry = createPackageRegistry<Env>({
            packages: [
                pkg({ key: 'db', env: { required: ['OBCF_D1', 'SECRET'] } }),
                pkg({ key: 'fine', health: () => ({ name: 'tables', ok: true }) }),
                pkg({
                    key: 'broken',
                    health: () => {
                        throw new TypeError('no binding');
                    },
                }),
            ],
        });
        const report = await runHealth(registry, { OBCF_D1: {} });
        expect(report.ok).toBe(false);
        expect(report.checks).toEqual([
            { package: 'db', name: 'env:OBCF_D1', ok: true },
            { package: 'db', name: 'env:SECRET', ok: false },
            { package: 'fine', name: 'tables', ok: true },
            { package: 'broken', name: 'probe', ok: false, detail: 'TypeError' },
        ]);

        const healthy = await runHealth(registry, { OBCF_D1: {}, SECRET: 's' });
        expect(healthy.checks.filter((c) => !c.ok).map((c) => c.package)).toEqual(['broken']);
    });
});

describe('applyPackageLifecycle', () => {
    it('installs once, upgrades on a version change, records versions, swallows hook errors, skips premium', async () => {
        const onInstall = vi.fn();
        const onUpgrade = vi.fn(() => {
            throw new Error('kv down');
        });
        const paidInstall = vi.fn();
        const store = createMemoryInstallStore();
        const log = vi.fn();
        const v1 = pkg({ key: 'notes', version: '1.0.0', lifecycle: { onInstall, onUpgrade } });
        const paid = pkg({ key: 'paid', premium: true, lifecycle: { onInstall: paidInstall } });

        const first = await applyPackageLifecycle({
            registry: createPackageRegistry({ packages: [v1, paid] }),
            env: {},
            store,
            now: () => 100,
            log,
        });
        expect(first).toEqual([{ key: 'notes', transition: 'install' }]);
        expect(onInstall).toHaveBeenCalledWith({ env: {}, key: 'notes', previousVersion: null, version: '1.0.0' });
        expect(paidInstall).not.toHaveBeenCalled();
        expect(await store.get('notes')).toEqual({ version: '1.0.0', installedAt: 100, updatedAt: 100 });

        const again = await applyPackageLifecycle({
            registry: createPackageRegistry({ packages: [v1] }),
            env: {},
            store,
        });
        expect(again).toEqual([{ key: 'notes', transition: 'none' }]);

        const v2 = pkg({ key: 'notes', version: '1.1.0', lifecycle: { onInstall, onUpgrade } });
        const upgraded = await applyPackageLifecycle({
            registry: createPackageRegistry({ packages: [v2] }),
            env: {},
            store,
            now: () => 200,
            log,
        });
        expect(upgraded).toEqual([{ key: 'notes', transition: 'upgrade', error: 'kv down' }]);
        expect(onUpgrade).toHaveBeenCalledWith({ env: {}, key: 'notes', previousVersion: '1.0.0', version: '1.1.0' });
        expect(log).toHaveBeenCalledWith(expect.stringContaining('upgrade hook failed'));
        expect(await store.get('notes')).toEqual({ version: '1.1.0', installedAt: 100, updatedAt: 200 });
    });
});
