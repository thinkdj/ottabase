// Email digests of new landing-site form entries, through the app's mailer, from the DB-driven
// cron scheduler (handler `landing:notify-leads`). The landing app only stores entries; this is
// where the configured mail provider lives.

import { sendTemplatedEmail } from '@ottabase/email/mailer';
import { leadDigest, LandingLead, LandingSite } from '@ottabase/ottalanding';
import { ScheduledTask } from '@ottabase/ottaorm/models';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { resolveAppMailer } from './email-provider';

export const LEAD_NOTIFY_HANDLER = 'landing:notify-leads';
const LEAD_NOTIFY_TASK = 'Landing form notifications';

/**
 * Email the entries nobody has been told about yet to the site's "Email new form entries to"
 * address, as one digest, then mark them notified.
 *
 * - No address set: they are marked notified without a send, so setting one later doesn't
 *   flood it with old entries (they are all in the inbox anyway).
 * - No mail provider, or a failed send: throws, so the task shows the failure in the cron
 *   admin, and the entries stay pending and go out once mail works.
 */
export async function notifyNewLeads(env: CloudflareEnv, inboxUrl?: string): Promise<number> {
    const appId = getOttabaseConfig(env).appId;
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
 * Make sure the every-minute notification task exists once an address is set. `inboxUrl` (the
 * admin's own address, taken from the request that saved the settings) goes into its payload
 * for the email's "Open the inbox" link. A task an admin paused stays paused.
 */
export async function ensureLeadNotifyTask(appId: string, inboxUrl: string): Promise<void> {
    const payload = JSON.stringify({ inboxUrl });
    const existing = await ScheduledTask.findByName(appId, LEAD_NOTIFY_TASK);
    if (existing) {
        if (existing.get('payload') !== payload) await ScheduledTask.update(existing.get('id') as string, { payload });
        return;
    }
    await ScheduledTask.createRegistered(
        {
            name: LEAD_NOTIFY_TASK,
            description: 'Emails new landing-site messages and signups to the address in the site settings.',
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
