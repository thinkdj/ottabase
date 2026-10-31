// New landing-site form entries, every minute, from the DB-driven cron scheduler (handler
// `landing:notify-leads`): each one goes out on the app's bus as `lead.created`, and the admin
// gets an email digest through the app's mailer. The landing app only stores entries; this is
// where the bus and the configured mail provider live.

import { sendTemplatedEmail } from '@ottabase/email/mailer';
import { leadDigest, LandingLead, LandingSite } from '@ottabase/ottalanding';
import { ScheduledTask } from '@ottabase/ottaorm/models';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { events } from '../../ottabase/events';
import { resolveAppMailer } from './email-provider';

export const LEAD_NOTIFY_HANDLER = 'landing:notify-leads';
export const LEAD_NOTIFY_DESCRIPTION =
    'Announces new landing-site messages and signups on the bus (lead.created) and emails them to the address in the site settings.';

/**
 * Tell the bus about every new entry, and the admin in one digest. The two keep their own
 * markers (`announcedAt`, `notifiedAt`), so neither holds the other back: a digest that can't
 * go out never delays `lead.created`. A failure in either still fails the task, visibly.
 * Returns how many entries the digest covered.
 */
export async function notifyNewLeads(env: CloudflareEnv, inboxUrl?: string): Promise<number> {
    const appId = getOttabaseConfig(env).appId;
    const [announced, mailed] = await Promise.allSettled([
        LandingLead.announceNew(appId, (lead) => events.emit(env, 'lead.created', lead)),
        mailLeadDigest(env, appId, inboxUrl),
    ]);
    if (announced.status === 'rejected') throw announced.reason;
    if (mailed.status === 'rejected') throw mailed.reason;
    return mailed.value;
}

/**
 * Email the entries nobody has been told about yet to the site's "Email new form entries to"
 * address, as one digest, then mark them notified.
 *
 * - No address set: they are marked notified without a send, so setting one later doesn't
 *   flood it with old entries (they are all in the inbox anyway).
 * - No mail provider, or a failed send: throws, so the task shows the failure in the cron
 *   admin, and the entries stay pending and go out once mail works.
 */
async function mailLeadDigest(env: CloudflareEnv, appId: string, inboxUrl?: string): Promise<number> {
    const pending = await LandingLead.pendingNotification(appId);
    if (!pending.length) return 0;
    const ids = pending.map((l) => l.get('id') as string);
    const settings = (await LandingSite.findForApp(appId))?.getSettings();
    if (!settings?.leadEmail) {
        await LandingLead.markNotified(appId, ids);
        return 0;
    }

    const { mailer, from, error } = await resolveAppMailer(env);
    if (!mailer) throw new Error(error ?? 'No email provider is configured');
    const { subject, header, body } = leadDigest(
        settings.name,
        pending.map((l) => l.toLead()),
        inboxUrl,
    );
    const result = await sendTemplatedEmail(mailer, {
        from,
        to: settings.leadEmail,
        template: 'default',
        subject,
        content: { header, body },
    });
    if (!result.success) throw new Error(result.error ?? 'The notification email could not be sent');
    await LandingLead.markNotified(appId, ids);
    return ids.length;
}

/**
 * Put the admin inbox URL (taken from the request that saved the settings) into the task's
 * payload, for the digest's "Open the inbox" link. The task itself is seeded on install (see
 * `ottabase/packages/ottalanding.ts`); it is created here only if that seed never ran. A task an
 * admin paused stays paused.
 */
export async function ensureLeadNotifyTask(appId: string, inboxUrl: string): Promise<void> {
    const payload = JSON.stringify({ inboxUrl });
    const existing = await ScheduledTask.findByName(appId, LEAD_NOTIFY_HANDLER);
    if (existing) {
        if (existing.get('payload') !== payload) await ScheduledTask.update(existing.get('id') as string, { payload });
        return;
    }
    await ScheduledTask.createRegistered(
        {
            name: LEAD_NOTIFY_HANDLER,
            description: LEAD_NOTIFY_DESCRIPTION,
            schedule: '* * * * *',
            taskType: 'handler',
            task: LEAD_NOTIFY_HANDLER,
            payload,
            isActive: true,
            appId,
        },
        [LEAD_NOTIFY_HANDLER],
    );
}
