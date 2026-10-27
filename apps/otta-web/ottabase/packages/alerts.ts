// ============================================================
// Alerts (@ottabase/alerts): where operator alerts go
// ============================================================
// One engine for the whole app. Packages that alert take it as their `alerts` option
// (Blackbox, Tower, Helpdesk, Privacy and PayPort in Ottabase Pro do) and call `raise()`;
// app code can too:
//
//     import { alerts } from '../ottabase/packages/alerts';
//     await alerts.raise(env, { source: 'app', kind: 'import.failed', title: 'Nightly import failed', severity: 'warning' });
//
// Channels (Slack, Discord, Telegram, PagerDuty, email, a signed webhook) are managed at
// Admin → Infrastructure → Alerts. With none, set ALERTS_EMAIL_TO for mail to a list of
// addresses; with neither, alerts are written to the log.
//
// ALERTS_SECRET (optional, falls back to AUTH_SECRET) seals channel targets in D1.
// ALERTS_INGEST_TOKEN (optional) opens POST /api/alerts/ingest to CI and other outside callers.
// Unhandled errors (a 5xx, a failed scheduled task, a queue job that gave up) become alerts,
// one per error shape per hour, until an error tracker that alerts on its own is installed.
// ============================================================

import { createAlerts, createAlertsPackage, type AlertMail } from '@ottabase/alerts';
import { getOttabaseConfig } from '../config.loader';
import { resolvePackageCaller } from './caller';

/** An optional var: unset and blank are the same. */
const optional = (value: string | undefined) => value?.trim() || null;

/** One alert mail through the app mailer. A throw is a failed delivery; the sweep retries it. */
async function sendMail(env: CloudflareEnv, mail: AlertMail): Promise<void> {
    // Dynamic: the mailer resolver pulls the auth providers in; a manifest load should not.
    const { resolveAppMailer } = await import('../../worker/lib/email-provider');
    const { mailer, from, error } = await resolveAppMailer(env);
    if (!mailer) throw new Error(`no mailer configured: ${error ?? 'none'}`);
    const sent = await mailer.send({ from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
    // The providers report a refusal as { success: false }, not a throw.
    if (!sent.success) throw new Error(sent.error ?? 'the mail provider refused the message');
}

export const alerts = createAlerts<CloudflareEnv>({
    appId: (env) => getOttabaseConfig(env).appId,
    appName: (env) => getOttabaseConfig(env).appName,
    baseUrl: (env) => env.AUTH_URL || null,
    secret: (env) => optional(env.ALERTS_SECRET) ?? env.AUTH_SECRET,
    emailTo: (env) => optional(env.ALERTS_EMAIL_TO),
    ingestToken: (env) => optional(env.ALERTS_INGEST_TOKEN),
    email: { send: sendMail },
});

export const alertsPackage = createAlertsPackage<CloudflareEnv>({
    alerts,
    resolveCaller: resolvePackageCaller,
    // Blackbox groups errors into issues and alerts on new and regressed ones itself: with it
    // installed, raw error alerts would say everything twice. Dynamic: the registry imports this file.
    reportErrors: async () => !(await import('../registry')).packages.has('blackbox'),
    // The ingest door, by address: the app's limiter, as the screenshot and PDF routes use it.
    rateLimit: (request, env) =>
        Promise.all([import('../../worker/lib/rate-limiting'), import('../../worker/lib/utils')]).then(
            ([{ enforceRateLimit }, { getClientIpAddress }]) =>
                enforceRateLimit(request, env, `alerts:ingest:${getClientIpAddress(request)}`),
        ),
    env: { optional: ['ALERTS_EMAIL_TO', 'ALERTS_SECRET', 'ALERTS_INGEST_TOKEN'] },
});
