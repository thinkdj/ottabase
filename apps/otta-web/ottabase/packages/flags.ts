// ============================================================
// Entitlements (@ottabase/flags): the plans this app sells, and who is on which
// ============================================================
// `resolvePlan` is where a billing package plugs in: payport's `activeTiers(subject)`, a
// column on the organization, anything the host knows. Until one is wired, every subject is
// on the default plan and operator overrides (Admin → Growth) do the rest.
// ============================================================

import { createFlags, createFlagsPackage, UNLIMITED } from '@ottabase/flags';
import { resolvePackageCaller } from './caller';

export const flags = createFlags<CloudflareEnv>({
    plans: {
        free: { label: 'Free', limits: { projects: 3, 'ai.calls': 20 } },
        pro: { label: 'Pro', features: ['export', 'api'], limits: { projects: UNLIMITED, 'ai.calls': 1_000 } },
    },
    defaultPlan: 'free',
    upgradeHref: '/billing',
});

export const flagsPackage = createFlagsPackage<CloudflareEnv>({
    flags,
    resolveCaller: resolvePackageCaller,
});
