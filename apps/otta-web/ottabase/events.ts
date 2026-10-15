// ============================================================
// The app's event bus (@ottabase/events)
// ============================================================
// One bus per app. Packages subscribe through their manifests (`events` field), which
// `ottabase/packages.ts` registers here after the registry is built. Emit from route
// handlers and models with `events.emit(env, name, payload, { actor, defer })`.
//
// Queued subscribers travel through OBCF_QUEUE as `events:deliver` jobs; the core
// package registers the matching queue handler. Without the binding they run inline.
// ============================================================

import { createEventBus } from '@ottabase/events';

export const events = createEventBus<CloudflareEnv>({
    queue: (env) => env.OBCF_QUEUE ?? null,
});
