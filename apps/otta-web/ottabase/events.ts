// ============================================================
// The app's event bus (@ottabase/events)
// ============================================================
// One bus per app. Packages subscribe through their manifests (`events` field), which
// `ottabase/packages.ts` registers here after the registry is built. Emit from route
// handlers and models with `events.emit(env, name, payload, { actor, defer })`.
//
// Queued subscribers travel through OBCF_QUEUE as `events:deliver` jobs; the core
// package registers the matching queue handler. Without the binding they run inline.
//
// The app's own events, beside what packages emit (`post.published`, `email.inbound`,
// `email.provider`, `email.unsubscribed`). Delivery is at-least-once: subscribers are idempotent.
//   `user.signed-in`  { userId, email, organizationId }  every sign-in, after provisioning
//   `user.created`    { userId, email, name, organizationId, method, at }  once per account:
//                     credentials sign-up and the bootstrap owner (with their workspace), an
//                     OAuth or magic-link first sign-in (organizationId null: the workspace
//                     comes with that sign-in's `user.signed-in`). method: credentials | oauth
//                     | magic-link | sso
//   `user.verified`   { userId, email, at }  once per account, when emailVerified is first
//                     set: the verify link, a magic link, an OAuth account (or owner) created
//                     verified
// The payload types: `UserCreatedEvent`, `UserVerifiedEvent` (@ottabase/auth/backend).
// otta:begin ottalanding
//   `lead.created`    { leadId, kind, email, name, message, pagePath, at }  once per landing
//                     form entry (kind: contact | signup), from the every-minute
//                     `landing:notify-leads` cron; `at` is when it was stored. Its payload
//                     type: `LeadCreatedEvent` (@ottabase/ottalanding).
// otta:end ottalanding
// ============================================================

import { createEventBus } from '@ottabase/events';

export const events = createEventBus<CloudflareEnv>({
    queue: (env) => env.OBCF_QUEUE ?? null,
});
