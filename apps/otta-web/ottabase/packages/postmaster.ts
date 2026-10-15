// ============================================================
// Postmaster (@ottabase/postmaster): the half of email that is not sending
// ============================================================
// Inbound mail from Cloudflare Email Routing lands on the bus as `email.inbound`; bounces and
// complaints from Resend/SES webhooks are recorded as suppressions and emitted as
// `email.provider`; unsubscribe links are signed with EMAIL_UNSUBSCRIBE_SECRET and resolve
// against AUTH_URL. Transactional mail (magic links) is NOT guarded: a password reset must go
// out. List senders wrap their mailer: `suppressions.guard(mailer, appId, 'newsletter')`.
// ============================================================

import {
    createInboundEmailHandler,
    createPostmasterPackage,
    createSuppressions,
    createUnsubscribe,
    type Unsubscribe,
} from '@ottabase/postmaster';
import { redactErrorForLog } from '@ottabase/utils/http-errors';
import { getOttabaseConfig } from '../config.loader';
import { events } from '../events';
import { ensureDbConnection } from '../../worker/lib/db-utils';

/** The app's suppression list, backed by `email_suppressions`. */
export const suppressions = createSuppressions();

const unsubscribers = new Map<string, Unsubscribe>();

/** Signed unsubscribe links for this env, or null until EMAIL_UNSUBSCRIBE_SECRET is set. */
export function unsubscribeFor(env: CloudflareEnv): Unsubscribe | null {
    const secret = env.EMAIL_UNSUBSCRIBE_SECRET;
    if (!secret) return null;
    const url = new URL('/api/email/hooks/unsubscribe', env.AUTH_URL || 'http://localhost:5173').toString();
    const key = `${secret}|${url}`;
    let minter = unsubscribers.get(key);
    if (!minter) {
        minter = createUnsubscribe({ secret, url });
        unsubscribers.set(key, minter);
    }
    return minter;
}

export const postmasterPackage = createPostmasterPackage<CloudflareEnv>({
    appId: (env) => getOttabaseConfig(env).appId,
    suppressions,
    unsubscribe: unsubscribeFor,
    resend: { webhookSecret: (env) => env.EMAIL_RESEND_WEBHOOK_SECRET },
    ses: { pathSecret: (env) => env.EMAIL_SES_WEBHOOK_SECRET },
    onProviderEvent: async (event, env) => {
        await events.emit(env, 'email.provider', event);
    },
    onUnsubscribe: async (entry, env) => {
        await events.emit(env, 'email.unsubscribed', entry);
    },
});

/**
 * The Worker's `email()` export. Email Routing is the gate (only addresses routed to this
 * Worker arrive), so every message is accepted and put on the bus for whichever package
 * wants it: a support desk threading by `mail.tag`, a lifecycle package reading replies.
 */
export const handleInboundEmail = createInboundEmailHandler<CloudflareEnv>({
    onMessage: async (mail, env, ctx) => {
        ensureDbConnection(env);
        await events.emit(env, 'email.inbound', mail, { defer: (work) => ctx.waitUntil(work) });
    },
    onError: (error) => console.error('[postmaster] inbound email rejected', redactErrorForLog(error)),
});
