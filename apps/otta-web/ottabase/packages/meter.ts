// ============================================================
// Usage credits (@ottabase/meter): balances per tenant and meter, consumed atomically
// ============================================================
// Charge for anything metered (AI calls, exports, renders): `meter.requireCredits()` before
// expensive work, `meter.consume()` after it. A billing package grants and resets balances
// on its webhooks; the admin routes do the same by hand.
// ============================================================

import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { createMeter, createMeterPackage } from '@ottabase/meter';
import { getOttabaseConfig } from '../config.loader';
import { resolvePackageCaller } from './caller';

export const meter = createMeter<CloudflareEnv>({
    driver: (env) => createD1Driver(env.OBCF_D1),
    upgradeHref: '/billing',
});

export const meterPackage = createMeterPackage<CloudflareEnv>({
    meter,
    resolveCaller: resolvePackageCaller,
    appId: (env) => getOttabaseConfig(env).appId,
});
