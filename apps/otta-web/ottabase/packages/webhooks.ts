// ============================================================
// Outbound webhooks — the Premium Package that ships with Ottabase as the worked example
// ============================================================
// Delete this file and its entry in `../packages.ts` (and the dependency) in a real app
// unless you actually want it. It is here so the premium framework has something real to
// demonstrate: a free tier of one endpoint, a licensed ceiling of 25, and a delivery log
// behind a feature gate.
// ============================================================

import { createWebhooksPackage } from '@ottabase/webhooks';
import { reserveWebhookEndpointSlot, synchronizeWebhookEndpointQuota } from '../../worker/lib/webhook-endpoint-quota';
import { resolvePackageCaller } from './caller';

export const webhooksPackage = createWebhooksPackage<CloudflareEnv>({
    resolveCaller: resolvePackageCaller,
    events: ['ping'],
    endpointQuota: {
        reserve: reserveWebhookEndpointSlot,
        synchronize: synchronizeWebhookEndpointQuota,
    },
});
