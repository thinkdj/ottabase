// ============================================================
// API keys (@ottabase/apikeys): the keys this app's customers create to call its API
// ============================================================
// Protect a route with `apiKeys.authenticate(request, env, { scopes })`; the subject it
// returns is who the key belongs to, and the only thing tenancy is stamped from.
// ============================================================

import { createApiKeys, createApiKeysPackage } from '@ottabase/apikeys';
import { resolvePackageCaller } from './caller';

export const apiKeys = createApiKeys<CloudflareEnv>({
    prefix: 'ok_live_',
    // The app's limiter, per key: a leaked or looping key cannot take the Worker down.
    afterVerify: (env, key, request) =>
        import('../../worker/lib/rate-limiting').then(({ enforceRateLimit }) =>
            enforceRateLimit(request, env, `apikey:${key.id}`),
        ),
});

export const apiKeysPackage = createApiKeysPackage<CloudflareEnv>({
    keys: apiKeys,
    resolveCaller: resolvePackageCaller,
    allowedScopes: ['read', 'write', 'events:ingest'],
});
