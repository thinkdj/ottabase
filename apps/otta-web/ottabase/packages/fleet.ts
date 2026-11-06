// ============================================================
// Fleet (@ottabase/fleet): makes this app watchable by a cockpit
// ============================================================
// `GET /api/fleet/report` behind FLEET_TOKEN: packages and versions, license states, the
// health report, scheduled tasks, newest backup, users and the brand icon. No `init`:
// otta-web's tables come from its migration routes, not from a remote button.
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
    sources: {
        backup: async (env) => (await vault.list(env, 1))[0] ?? null, // otta:only vault
        // The home brand kit's square icon, which a cockpit copies for its board and mail.
        // Dynamic: the brand helpers reach the files service, which imports the package list.
        icon: async (env) => {
            const kit = await (await import('../../worker/lib/brand-utils')).homeBrandKit(env);
            return kit?.logos.icon ?? kit?.logos.emailLogo ?? null;
        },
    },
    // Dynamic: the premium registry imports the package list, which imports this file.
    licenses: async (env) => (await import('../../worker/lib/premium')).premium.statuses(env),
});
