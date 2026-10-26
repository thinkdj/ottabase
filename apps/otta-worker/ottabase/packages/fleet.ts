// ============================================================
// Fleet (@ottabase/fleet): makes this Worker watchable by a cockpit
// ============================================================
// `GET /api/fleet/report` answers FLEET_TOKEN with this Worker's packages, health, tasks,
// newest backup and license states; `POST /api/fleet/init` does what `POST /api/admin/init`
// does. Identical to otta-web's composition but for `init`.
// ============================================================

import { createFleetPackage } from '@ottabase/fleet';
import { getOttabaseConfig } from '../config.loader';
import { vault } from './vault';

export const fleetPackage = createFleetPackage<CloudflareEnv>({
    appId: (env) => getOttabaseConfig(env).appId,
    environment: (env) => getOttabaseConfig(env).environment,
    token: (env) => env.FLEET_TOKEN,
    sources: { backup: async (env) => (await vault.list(env, 1))[0] ?? null },
    // Dynamic imports: the premium registry and db-utils import the package list, which imports this file.
    licenses: async (env) => (await import('../premium')).premium.statuses(env),
    init: async (env) => {
        if (!env.OBCF_D1) throw new Error('OBCF_D1 is not bound');
        const [{ initDatabase }, { ensurePackageSchedules }, { packages }] = await Promise.all([
            import('../../worker/lib/db-utils'),
            import('../../worker/lib/package-schedules'),
            import('../packages'),
        ]);
        const result = await initDatabase(env);
        const seededSchedules = await ensurePackageSchedules(packages, getOttabaseConfig(env).appId);
        return { ...result, seededSchedules };
    },
});
