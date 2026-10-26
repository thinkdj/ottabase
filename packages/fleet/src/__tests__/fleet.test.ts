// ============================================================
// Fleet, mounted like any free package and read the way a cockpit (or curl) reads it.
// ============================================================

import { createPackageRegistry, definePackage, mountPackages } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { describe, expect, it, vi } from 'vitest';
import { createFleetPackage, summarize, type FleetReport, type FleetReportTask } from '../index';

type Env = { FLEET_TOKEN?: string; broken?: boolean; cronFailed?: boolean; tasksThrow?: boolean };
const T0 = Date.UTC(2026, 9, 16, 12, 0, 0);

const task = (over: Partial<FleetReportTask> = {}): FleetReportTask => ({
    name: 'Nightly backup',
    task: 'vault:backup',
    isActive: true,
    lastStatus: 'success',
    lastRunAt: T0 - 86_400_000,
    lastError: null,
    failCount: 0,
    ...over,
});

function app(input: { init?: 'ok' | 'throws'; licenses?: boolean } = {}) {
    const widgets = definePackage<Env>({
        key: 'widgets',
        name: 'Widgets',
        version: '1.0.0',
        health: (env) => ({ name: 'db', ok: !env.broken }),
    });
    const pkg = createFleetPackage<Env>({
        appId: () => 'tool',
        environment: () => 'test',
        now: () => T0,
        sources: {
            tasks: async (env) => {
                if (env.tasksThrow) throw new Error('boom');
                return [
                    task(env.cronFailed ? { lastStatus: 'failed', lastError: 'bucket missing', failCount: 1 } : {}),
                ];
            },
            backup: async () => ({ id: 'b1', createdAt: '2026-10-16T02:23:00.000Z' }),
        },
        ...(input.init === 'ok' ? { init: async () => ({ created: 3 }) } : {}),
        ...(input.init === 'throws'
            ? {
                  init: async () => {
                      throw new Error('OBCF_D1 is not bound');
                  },
              }
            : {}),
        ...(input.licenses ? { licenses: async () => [{ key: 'widgets', state: 'active', plan: 'pro' }] } : {}),
    });
    const packages = createPackageRegistry<Env>({ packages: [widgets, pkg] });
    const router = new Router<Env>();
    const mounted = mountPackages(router, { packages });
    const call = (path: string, init: RequestInit = {}, env: Env = {}) =>
        router.handle(new Request(`https://tool.test/api/fleet${path}`, init), env);
    return { pkg, mounted, call };
}

const bearer = (token: string): RequestInit => ({ headers: { authorization: `Bearer ${token}` } });
const TOKEN: Env = { FLEET_TOKEN: 'tok' };
const data = async <T>(response: Response | null | undefined): Promise<T> => {
    expect(response).toBeTruthy();
    return ((await response!.json()) as { data: T }).data;
};

describe('the fleet package', () => {
    it('is a free package at /api/fleet whose health line says whether it can be watched', async () => {
        const { pkg, mounted } = app();
        expect(pkg.premium).toBeUndefined();
        expect(mounted).toEqual(['/api/fleet']);
        expect(pkg.env).toEqual({ optional: ['FLEET_TOKEN'] });
        expect(await pkg.health!({})).toMatchObject({
            name: 'fleet:token',
            ok: true,
            detail: expect.stringContaining('unset'),
        });
        expect(await pkg.health!(TOKEN)).toMatchObject({
            ok: true,
            detail: expect.stringContaining('/api/fleet/report'),
        });
    });

    it('refuses without a configured token, without a header, with the wrong one; answers the right one', async () => {
        const { call } = app({ licenses: true });
        expect((await call('/report'))?.status).toBe(503);
        expect(((await (await call('/report'))?.json()) as { code: string }).code).toBe('NOT_CONFIGURED');
        expect((await call('/report', {}, TOKEN))?.status).toBe(401);
        expect((await call('/report', bearer('nope'), TOKEN))?.status).toBe(401);

        const report = await data<FleetReport>(await call('/report', bearer('tok'), TOKEN));
        expect(report).toEqual({
            app: 'tool',
            environment: 'test',
            takenAt: T0,
            packages: [
                {
                    key: 'widgets',
                    name: 'Widgets',
                    version: '1.0.0',
                    premium: { state: 'active', plan: 'pro', expiresAt: null },
                },
                { key: 'fleet', name: 'Fleet', version: '1.0.0' },
            ],
            health: {
                ok: true,
                checks: [
                    { package: 'widgets', name: 'db', ok: true },
                    { package: 'fleet', name: 'fleet:token', ok: true, detail: expect.any(String) },
                ],
            },
            tasks: [task()],
            backup: { id: 'b1', createdAt: '2026-10-16T02:23:00.000Z' },
            canInit: false,
            errors: [],
        });

        const broken = await data<FleetReport>(await call('/report', bearer('tok'), { ...TOKEN, broken: true }));
        expect(broken.health.ok).toBe(false);
    });

    it('names a source that threw and keeps the rest of the report', async () => {
        const { call } = app();
        const report = await data<FleetReport>(await call('/report', bearer('tok'), { ...TOKEN, tasksThrow: true }));
        expect(report.errors).toEqual(['tasks: boom']);
        expect(report.tasks).toEqual([]);
        expect(report.backup?.id).toBe('b1');
    });

    it('runs the host init, says when it has none, and reports one that failed', async () => {
        const post: RequestInit = { method: 'POST', ...bearer('tok') };
        expect((await app().call('/init', post, TOKEN))?.status).toBe(501);
        expect(await data(await app({ init: 'ok' }).call('/init', post, TOKEN))).toEqual({ created: 3 });
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
        const failed = await app({ init: 'throws' }).call('/init', post, TOKEN);
        expect(failed?.status).toBe(500);
        expect(await failed?.json()).toMatchObject({ code: 'INIT_FAILED' }); // the cause is logged, not returned
        expect(quiet).toHaveBeenCalledWith('[fleet] init failed', 'OBCF_D1 is not bound');
        quiet.mockRestore();
        expect((await app({ init: 'ok' }).call('/init', { method: 'POST' }, TOKEN))?.status).toBe(401);
    });
});

describe('summarize', () => {
    const report = (over: Partial<FleetReport>): FleetReport => ({
        app: 'tool',
        environment: 'test',
        takenAt: T0,
        packages: [],
        health: { ok: true, checks: [] },
        tasks: [],
        backup: null,
        canInit: false,
        errors: [],
        ...over,
    });

    it('is ok with nothing failing, degraded on a failing check or a failing ACTIVE task', () => {
        expect(summarize(report({}))).toEqual({ status: 'ok', detail: null });
        expect(
            summarize(
                report({
                    health: { ok: false, checks: [{ package: 'core', name: 'env:OBCF_R2', ok: false }] },
                    tasks: [
                        task({ lastStatus: 'failed' }),
                        task({ task: 'old:job', isActive: false, lastStatus: 'failed' }),
                    ],
                }),
            ),
        ).toEqual({ status: 'degraded', detail: 'core/env:OBCF_R2, cron vault:backup' });
    });
});
