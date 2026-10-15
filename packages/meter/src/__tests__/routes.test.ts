import { createPackageRegistry, mountPackages } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMeter, createMeterPackage, createMeterRouter, type MeterCaller } from '../index';
import { fakeD1 } from './fake-d1';

type Env = { d1: ReturnType<typeof fakeD1> };
let caller: MeterCaller | null = null;

function app() {
    const d1 = fakeD1();
    const env: Env = { d1 };
    const meter = createMeter<Env>({ driver: (e) => e.d1 });
    const router = createMeterRouter<Env>({ meter, resolveCaller: async () => caller });
    return { env, meter, router };
}

const request = (path: string, init?: RequestInit) => new Request(`https://app.test${path}`, init);
const post = (body: unknown) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
});
const data = async <T>(response: Response | null) => ((await response!.json()) as { data: T }).data;

describe('meter routes', () => {
    beforeEach(() => {
        caller = { appId: 'app', organizationId: 'org-1', userId: 'u-1' };
    });

    it('a member reads their balances and one meter with its usage; anonymous is 401', async () => {
        const { env, meter, router } = app();
        const subject = { appId: 'app', organizationId: 'org-1', userId: 'u-1' };
        await meter.grant(env, subject, 'ai.calls', { credits: 10 });
        await meter.consume(env, subject, 'ai.calls', 3, { ref: 'r1' });

        expect(await data<unknown[]>(await router.handle(request('/me'), env))).toHaveLength(1);
        const one = await data<{ remaining: number; usage: unknown[] }>(
            await router.handle(request('/me/ai.calls'), env),
        );
        expect(one.remaining).toBe(7);
        expect(one.usage).toHaveLength(1);
        expect((await router.handle(request('/me/nope'), env))?.status).toBe(404);

        caller = null;
        expect((await router.handle(request('/me'), env))?.status).toBe(401);
    });

    it('grant, top-up and reset are platform-admin only and validated', async () => {
        const { env, router } = app();
        const grant = { organizationId: 'org-2', meter: 'ai.calls', credits: 5 };
        expect((await router.handle(request('/grant', post(grant)), env))?.status).toBe(403);

        caller = { appId: 'app', organizationId: null, userId: 'admin', platformAdmin: true };
        expect((await router.handle(request('/grant', post({ meter: 'ai.calls', credits: 5 })), env))?.status).toBe(
            400,
        );
        expect((await router.handle(request('/grant', post({ ...grant, credits: -1 })), env))?.status).toBe(400);
        expect((await router.handle(request('/grant', post({ ...grant, meter: 'bad name!' })), env))?.status).toBe(400);

        const created = await router.handle(request('/grant', post(grant)), env);
        expect(created?.status).toBe(201);
        expect(await data<{ remaining: number }>(created)).toMatchObject({ remaining: 5 });

        expect(
            await data<{ credits: number }>(
                await router.handle(
                    request('/top-up', post({ organizationId: 'org-2', meter: 'ai.calls', amount: 2 })),
                    env,
                ),
            ),
        ).toMatchObject({ credits: 7 });
        expect(
            (
                await router.handle(
                    request('/top-up', post({ organizationId: 'org-2', meter: 'ai.calls', amount: 0 })),
                    env,
                )
            )?.status,
        ).toBe(400);
        expect(
            (
                await router.handle(
                    request('/top-up', post({ organizationId: 'org-9', meter: 'ai.calls', amount: 1 })),
                    env,
                )
            )?.status,
        ).toBe(404);

        expect(
            await data<{ used: number }>(
                await router.handle(request('/reset', post({ organizationId: 'org-2', meter: 'ai.calls' })), env),
            ),
        ).toMatchObject({ used: 0 });
        const listed = await data<unknown[]>(await router.handle(request('/balances?organizationId=org-2'), env));
        expect(listed).toHaveLength(1);
    });

    it('is a kernel package: two tables, two models, policies, routes and a seeded prune', async () => {
        const { env, meter } = app();
        const pkg = createMeterPackage<Env>({ meter, resolveCaller: async () => caller, appId: () => 'app' });
        expect(Object.keys(pkg.tables!).sort()).toEqual(['meterBalancesTable', 'meterUsageTable']);
        expect(pkg.policies?.map((policy) => policy.model)).toEqual(['meter_balances', 'meter_usage']);
        expect(pkg.cron?.['meter:prune-usage']?.schedule).toBe('41 3 * * *');

        const router = new Router<Env>();
        const packages = createPackageRegistry({ packages: [pkg] });
        expect(mountPackages(router, { packages })).toEqual(['/api/meter']);
        expect((await router.handle(request('/api/meter/me'), env))?.status).toBe(200);

        await pkg.cron!['meter:prune-usage'].handler({
            env,
            taskId: 't',
            taskName: 'n',
            schedule: '',
            payload: { olderThanDays: 30 },
        } as never);
    });
});
