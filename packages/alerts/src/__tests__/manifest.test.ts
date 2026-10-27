// ============================================================
// The manifest: what it contributes, the error reporter that turns unhandled errors into
// alerts (and steps aside when told to), the cron jobs and the health probe.
// ============================================================

import { createPackageRegistry, runHealth } from '@ottabase/kernel';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALERTS_PRUNE_HANDLER, ALERTS_SWEEP_HANDLER } from '../constants';
import { alertFromIncident, createAlertsPackage, errorShape } from '../manifest';
import { ENV, SLACK_URL, closeDatabase, makeEngine, openDatabase, type TestEnv } from './harness';

beforeEach(openDatabase);
afterAll(closeDatabase);

const resolveCaller = () => null;

describe('createAlertsPackage', () => {
    it('contributes four tables, four models, two cron jobs, one nav entry, routes and a probe', () => {
        const pkg = createAlertsPackage<TestEnv>({ alerts: makeEngine().alerts, resolveCaller });
        expect(Object.keys(pkg.tables!)).toEqual([
            'alertChannelsTable',
            'alertEventsTable',
            'alertDeliveriesTable',
            'alertKeysTable',
        ]);
        expect(pkg.models).toHaveLength(4);
        expect(Object.keys(pkg.cron!)).toEqual([ALERTS_SWEEP_HANDLER, ALERTS_PRUNE_HANDLER]);
        expect(pkg.cron![ALERTS_SWEEP_HANDLER]!.schedule).toBe('*/5 * * * *');
        expect(pkg.nav).toEqual([
            expect.objectContaining({ href: '/admin/infrastructure/alerts', group: 'infrastructure' }),
        ]);
        expect(pkg.premium).toBeUndefined();
        expect(createPackageRegistry({ packages: [pkg] }).keys()).toEqual(['alerts']);
    });

    it('runs the sweep and the prune from cron', async () => {
        const engine = makeEngine();
        const pkg = createAlertsPackage<TestEnv>({ alerts: engine.alerts, resolveCaller });
        const run = (name: string) =>
            pkg.cron![name]!.handler({ env: ENV, taskId: 't', taskName: name, schedule: '', payload: null } as never);
        await expect(run(ALERTS_SWEEP_HANDLER)).resolves.toBeUndefined();
        await expect(run(ALERTS_PRUNE_HANDLER)).resolves.toBeUndefined();
    });

    it('reports its channels in the health report', async () => {
        const engine = makeEngine();
        const registry = createPackageRegistry({
            packages: [createAlertsPackage<TestEnv>({ alerts: engine.alerts, resolveCaller })],
        });
        expect((await runHealth(registry, ENV)).checks).toEqual([
            { package: 'alerts', name: 'alerts:channels', ok: true, detail: 'no channels: alerts are only logged' },
        ]);
        await engine.alerts.createChannel(ENV, { name: 'Ops', type: 'slack', url: SLACK_URL });
        expect((await runHealth(registry, ENV)).checks[0]).toMatchObject({ ok: true, detail: '1 channel delivering' });
    });
});

describe('unhandled errors', () => {
    it('one alert per error shape, wherever it broke, without the ids', () => {
        expect(errorShape('User 1234 not found in 9f86d081-884c-7d65-9a2f-ea0c5f3c0d1e')).toBe('User # not found in #');
        const request = new Request('https://acme.test/api/users/42?token=secret', { method: 'POST' });
        const alert = alertFromIncident({
            error: new TypeError('Cannot read x of undefined'),
            env: ENV,
            source: 'request',
            request,
            requestId: 'ray-1',
        });
        expect(alert).toMatchObject({
            source: 'errors',
            kind: 'request',
            severity: 'warning',
            title: 'Server error (POST /api/users/42): TypeError: Cannot read x of undefined',
            fields: [
                { label: 'Where', value: 'POST /api/users/42' },
                { label: 'Request id', value: 'ray-1' },
            ],
            // The path is not in the key: a caller chooses it.
            key: 'errors:request:TypeError:Cannot read x of undefined',
        });
        expect(JSON.stringify(alert)).not.toContain('token=secret');
        expect(alertFromIncident({ error: 'boom', env: ENV, source: 'cron', task: 'vault:backup' }).title).toBe(
            'Scheduled task failed (vault:backup): NonErrorThrow: boom',
        );
    });

    it('raises through the kernel, once per hour per shape, and not at all when switched off', async () => {
        const engine = makeEngine();
        await engine.alerts.createChannel(ENV, { name: 'Ops', type: 'slack', url: SLACK_URL });
        const on = createPackageRegistry({
            packages: [createAlertsPackage<TestEnv>({ alerts: engine.alerts, resolveCaller })],
        });
        const raise = vi.spyOn(engine.alerts, 'raise');
        // A storm: one raise, the rest never reach D1.
        for (let i = 0; i < 50; i++) {
            await on.report({ error: new Error(`queue down for job ${i}`), env: ENV, source: 'queue', task: 'mail' });
        }
        expect(raise).toHaveBeenCalledTimes(1);
        expect(engine.net.sent).toHaveLength(1);
        // An hour on, the same shape is news again.
        engine.clock.now += 61 * 60_000;
        await on.report({ error: new Error('queue down for job 51'), env: ENV, source: 'queue', task: 'mail' });
        expect(raise).toHaveBeenCalledTimes(2);
        expect(engine.net.sent).toHaveLength(2);
        raise.mockRestore();

        const off = createPackageRegistry({
            packages: [
                createAlertsPackage<TestEnv>({ alerts: engine.alerts, resolveCaller, reportErrors: async () => false }),
            ],
        });
        await off.report({ error: new Error('another'), env: ENV, source: 'other' });
        expect(engine.net.sent).toHaveLength(2);
    });
});
