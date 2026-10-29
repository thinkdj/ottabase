// ============================================================
// Outbound webhooks (@ottabase/webhooks)
// ============================================================
// Customers register signed HTTPS endpoints at Admin → Growth → Webhooks. The app emits
// `ping` from the test route; add every product event your domain writes dispatch to
// `events` as you add its `dispatchWebhookEvent` call.
// ============================================================

import { createWebhooksPackage } from '@ottabase/webhooks';
import { getOttabaseConfig } from '../config.loader';
import { resolvePackageCaller } from './caller';

export const webhooksPackage = createWebhooksPackage<CloudflareEnv>({
    resolveCaller: resolvePackageCaller,
    appId: (env) => getOttabaseConfig(env).appId,
    events: ['ping'],
});
