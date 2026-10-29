// ============================================================
// Fleet (@ottabase/fleet): makes this app watchable by a cockpit
// ============================================================
// `GET /api/fleet/report` behind FLEET_TOKEN: packages and versions, license states, the
// health report, scheduled tasks, newest backup. No `init`: otta-web's tables come from its
// migration routes, not from a remote button.
// ============================================================

import { createFleetPackage } from '@ottabase/fleet';
import { readDeploymentVersion } from '@ottabase/kernel';
import { getOttabaseConfig } from '../config.loader';
import { vault } from './vault'; // otta:only vault

export const fleetPackage = createFleetPackage<CloudflareEnv>({
    appId: (env) => getOttabaseConfig(env).appId,
    environment: (env) => env.ENVIRONMENT || 'development',
    version: (env) => readDeploymentVersion(env.OBCF_VERSION),
    token: (env) => env.FLEET_TOKEN,
    sources: { backup: async (env) => (await vault.list(env, 1))[0] ?? null }, // otta:only vault
    // Dynamic: the premium registry imports the package list, which imports this file.
    licenses: async (env) => (await import('../../worker/lib/premium')).premium.statuses(env),
});
