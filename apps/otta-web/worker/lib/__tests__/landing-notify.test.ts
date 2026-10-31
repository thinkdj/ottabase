/**
 * The landing cron: every new form entry on the bus (`lead.created`), and the digest: who gets told,
 * when, and what happens when mail can't go out (entries stay pending, the events still go out,
 * and the cron task fails visibly).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    pending: vi.fn(),
    announceNew: vi.fn(),
    emit: vi.fn(),
    markNotified: vi.fn(),
    findSite: vi.fn(),
    resolveAppMailer: vi.fn(),
    send: vi.fn(),
    findByName: vi.fn(),
    createRegistered: vi.fn(),
    updateTask: vi.fn(),
}));
vi.mock('@ottabase/ottalanding', async (importOriginal) => ({
    leadDigest: (await importOriginal<typeof import('@ottabase/ottalanding')>()).leadDigest,
    LandingLead: { pendingNotification: m.pending, markNotified: m.markNotified, announceNew: m.announceNew },
    LandingSite: { findForApp: m.findSite },
}));
vi.mock('@ottabase/email/mailer', () => ({ sendTemplatedEmail: m.send }));
vi.mock('../email-provider', () => ({ resolveAppMailer: m.resolveAppMailer }));
vi.mock('@ottabase/ottaorm/models', () => ({
    ScheduledTask: { findByName: m.findByName, createRegistered: m.createRegistered, update: m.updateTask },
}));
vi.mock('../../../ottabase/config.loader', () => ({ getOttabaseConfig: () => ({ appId: 'otta-web' }) }));
vi.mock('../../../ottabase/events', () => ({ events: { emit: m.emit } }));

import { ensureLeadNotifyTask, LEAD_NOTIFY_HANDLER, notifyNewLeads } from '../landing-notify';

const entry = (id: string, name: string) => ({
    get: (key: string) => (key === 'id' ? id : undefined),
    toLead: () => ({
        id,
        kind: 'contact',
        email: `${name.toLowerCase()}@x.dev`,
        name,
        message: 'Hi',
        pagePath: '/contact',
        read: false,
        createdAt: '2026-10-11T00:00:00.000Z',
    }),
});
const site = (settings: object) => ({ getSettings: () => ({ name: 'Acme', ...settings }) });
const env = {} as CloudflareEnv;

describe('notifyNewLeads', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        m.resolveAppMailer.mockResolvedValue({ mailer: {}, from: 'noreply@acme.dev' });
        m.send.mockResolvedValue({ success: true });
        m.announceNew.mockResolvedValue(0);
    });

    it('does nothing when nothing is new', async () => {
        m.pending.mockResolvedValue([]);
        expect(await notifyNewLeads(env)).toBe(0);
        expect(m.findSite).not.toHaveBeenCalled();
    });

    it('sends one digest of everything new to the configured address, then marks it all', async () => {
        m.pending.mockResolvedValue([entry('a', 'Ada'), entry('b', 'Grace')]);
        m.findSite.mockResolvedValue(site({ leadEmail: 'me@acme.dev' }));
        expect(await notifyNewLeads(env, 'https://admin.acme.dev/admin/content/landing/leads')).toBe(2);
        expect(m.send).toHaveBeenCalledTimes(1);
        const [, mail] = m.send.mock.calls[0];
        expect(mail).toMatchObject({ from: 'noreply@acme.dev', to: 'me@acme.dev', template: 'default' });
        expect(mail.subject).toBe('Acme: 2 new form entries');
        expect(mail.content.body).toContain('Open the inbox');
        expect(m.markNotified).toHaveBeenCalledWith('otta-web', ['a', 'b']);
    });

    it('with no address, retires the backlog without sending, so a later address isn’t flooded', async () => {
        m.pending.mockResolvedValue([entry('a', 'Ada')]);
        m.findSite.mockResolvedValue(site({}));
        expect(await notifyNewLeads(env)).toBe(0);
        expect(m.send).not.toHaveBeenCalled();
        expect(m.markNotified).toHaveBeenCalledWith('otta-web', ['a']);
    });

    it('keeps entries pending and fails loudly when mail can’t go out', async () => {
        m.pending.mockResolvedValue([entry('a', 'Ada')]);
        m.findSite.mockResolvedValue(site({ leadEmail: 'me@acme.dev' }));
        m.resolveAppMailer.mockResolvedValueOnce({ mailer: null, error: 'No email provider configured' });
        await expect(notifyNewLeads(env)).rejects.toThrow('No email provider configured');
        m.send.mockResolvedValueOnce({ success: false, error: 'Resend said no' });
        await expect(notifyNewLeads(env)).rejects.toThrow('Resend said no');
        expect(m.markNotified).not.toHaveBeenCalled();
    });

    it('announces new entries on the bus as lead.created', async () => {
        m.pending.mockResolvedValue([]);
        m.emit.mockResolvedValue({ delivered: 1 });
        await notifyNewLeads(env);

        expect(m.announceNew).toHaveBeenCalledWith('otta-web', expect.any(Function));
        const lead = { leadId: 'a', kind: 'signup', email: 'a@x.dev', name: '', message: '', pagePath: '/', at: 1 };
        await m.announceNew.mock.calls[0][1](lead);
        expect(m.emit).toHaveBeenCalledWith(env, 'lead.created', lead);
    });

    it('a digest that can’t go out never holds back the events, and the task still fails', async () => {
        m.pending.mockResolvedValue([entry('a', 'Ada')]);
        m.findSite.mockResolvedValue(site({ leadEmail: 'me@acme.dev' }));
        m.announceNew.mockResolvedValue(1);
        m.send.mockResolvedValue({ success: false, error: 'Resend said no' });

        await expect(notifyNewLeads(env)).rejects.toThrow('Resend said no');
        await expect(m.announceNew.mock.results[0].value).resolves.toBe(1);
        expect(m.markNotified).not.toHaveBeenCalled();
    });

    it('a bus that is down never holds back the digest, and the task still fails', async () => {
        m.pending.mockResolvedValue([entry('a', 'Ada')]);
        m.findSite.mockResolvedValue(site({ leadEmail: 'me@acme.dev' }));
        m.announceNew.mockRejectedValue(new Error('queue down'));

        await expect(notifyNewLeads(env)).rejects.toThrow('queue down');
        expect(m.send).toHaveBeenCalledTimes(1);
        expect(m.markNotified).toHaveBeenCalledWith('otta-web', ['a']);
    });
});

describe('ensureLeadNotifyTask', () => {
    beforeEach(() => vi.clearAllMocks());

    it('creates the every-minute task under the name the install seed uses, if the seed never ran', async () => {
        m.findByName.mockResolvedValue(null);
        await ensureLeadNotifyTask('otta-web', 'https://admin.acme.dev/admin/content/landing/leads');
        expect(m.findByName).toHaveBeenCalledWith('otta-web', LEAD_NOTIFY_HANDLER);
        expect(m.createRegistered).toHaveBeenCalledWith(
            expect.objectContaining({
                name: LEAD_NOTIFY_HANDLER,
                schedule: '* * * * *',
                task: LEAD_NOTIFY_HANDLER,
                isActive: true,
                appId: 'otta-web',
                payload: JSON.stringify({ inboxUrl: 'https://admin.acme.dev/admin/content/landing/leads' }),
            }),
            [LEAD_NOTIFY_HANDLER],
        );
    });

    it('only refreshes the inbox link on an existing task, leaving a paused one paused', async () => {
        const existing = { get: (k: string) => (k === 'id' ? 't1' : k === 'payload' ? '{"inboxUrl":"old"}' : false) };
        m.findByName.mockResolvedValue(existing);
        await ensureLeadNotifyTask('otta-web', 'https://new/admin/content/landing/leads');
        expect(m.updateTask).toHaveBeenCalledWith('t1', {
            payload: JSON.stringify({ inboxUrl: 'https://new/admin/content/landing/leads' }),
        });
        expect(m.createRegistered).not.toHaveBeenCalled();

        m.updateTask.mockClear();
        m.findByName.mockResolvedValue({
            get: (k: string) => (k === 'payload' ? JSON.stringify({ inboxUrl: 'same' }) : 't1'),
        });
        await ensureLeadNotifyTask('otta-web', 'same');
        expect(m.updateTask).not.toHaveBeenCalled();
    });
});
