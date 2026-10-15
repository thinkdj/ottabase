// One bus per app. Packages subscribe through their manifests; emit with
// `events.emit(env, name, payload, { defer })`. Queued subscribers travel through OBCF_QUEUE
// when it is bound, inline otherwise.
import { createEventBus } from '@ottabase/events';

export const events = createEventBus<CloudflareEnv>({
    queue: (env) => env.OBCF_QUEUE ?? null,
});
