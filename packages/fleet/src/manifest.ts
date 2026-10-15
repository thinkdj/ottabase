// ============================================================
// @ottabase/fleet — the manifest (a free package)
// ============================================================
// Listing this makes an app WATCHABLE: `GET /api/fleet/report` behind FLEET_TOKEN. It is
// deliberately the free half. Whatever watches a fleet of these (Tower, sold separately)
// needs every app, including other people's, to carry the beacon; a beacon behind a paywall
// would have nothing to report to.
// ============================================================

import { definePackage, type OttaPackage } from '@ottabase/kernel';
import { createReporter } from './beacon';
import { FLEET_BASE_PATH, FLEET_PACKAGE_KEY, FLEET_TOKEN_ENV } from './constants';
import { createBeaconRouter } from './routes';
import type { FleetOptions } from './types';

/** The beacon as the app registers it: two token-guarded routes and a health line saying whether it can be watched. */
export function createFleetPackage<Env = unknown>(options: FleetOptions<Env>): OttaPackage<Env> {
    const { basePath = FLEET_BASE_PATH, env = { optional: [FLEET_TOKEN_ENV] } } = options;
    const token = options.token ?? ((requestEnv: Env) => (requestEnv as { FLEET_TOKEN?: string } | null)?.FLEET_TOKEN);

    return definePackage<Env>({
        key: FLEET_PACKAGE_KEY,
        name: 'Fleet beacon',
        version: '1.0.0',
        description:
            'Answers GET /api/fleet/report to FLEET_TOKEN with this app’s packages, license states, health, scheduled tasks and newest backup, so a cockpit can watch it.',
        docsUrl: 'https://github.com/thinkdj/ottabase/tree/main/packages/fleet#readme',

        routes: {
            basePath,
            build: (host) =>
                createBeaconRouter<Env>({
                    report: createReporter(host.packages, options),
                    token,
                    ...(options.init ? { init: options.init } : {}),
                }),
        },

        env,
        health: (requestEnv) => ({
            name: 'fleet:beacon',
            ok: true,
            detail: token(requestEnv)?.trim()
                ? `${FLEET_TOKEN_ENV} set: a cockpit can read ${basePath}/report`
                : `${FLEET_TOKEN_ENV} unset: this app cannot be watched`,
        }),
    });
}
