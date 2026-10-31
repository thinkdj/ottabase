/**
 * Leads: what visitors send through the contact and signup sections.
 *
 * The public site posts to `LEAD_ENDPOINT` (served by the landing app), the entry is stored as a
 * `landing_leads` row, and otta-web shows it in the admin inbox and emails a digest.
 */

import { z } from 'zod';
import { EMAIL } from './fields';
import { PAGE_PATH } from './site';

export const LEAD_KINDS = ['contact', 'signup'] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

/** Where the public site's forms post (a route of the landing app). */
export const LEAD_ENDPOINT = '/api/leads';

/** Per network (hashed IP): at most this many entries in the window, then 429. */
export const LEAD_RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 } as const;

/** Faster than a person can fill in a form: almost certainly a bot. */
export const LEAD_MIN_FILL_MS = 2500;

export const LeadInputSchema = z
    .object({
        kind: z.enum(LEAD_KINDS),
        email: z.string().trim().toLowerCase().max(254).regex(EMAIL, 'Enter an email address like name@example.com'),
        name: z.string().trim().max(120).optional().default(''),
        message: z.string().trim().max(4000).optional().default(''),
        pagePath: z.string().max(200).regex(PAGE_PATH).optional().default('/'),
    })
    .superRefine((lead, ctx) => {
        if (lead.kind !== 'contact') return;
        if (!lead.name) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['name'], message: 'Please add your name' });
        if (!lead.message) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['message'], message: 'Please write a message' });
        }
    });

export type LeadInput = z.input<typeof LeadInputSchema>;

/** A lead as the admin sees it. */
export type LeadData = {
    id: string;
    kind: LeadKind;
    email: string;
    name: string;
    message: string;
    pagePath: string;
    read: boolean;
    createdAt: string;
};

/** The `lead.created` bus payload, one per stored entry (`LandingLead.announceNew`). `at` is when it was stored. */
export type LeadCreatedEvent = {
    leadId: string;
    kind: LeadKind;
    email: string;
    name: string;
    message: string;
    pagePath: string;
    at: number;
};

/**
 * Leads as CSV for a spreadsheet. Cells are quoted, and a cell that a spreadsheet would run as
 * a formula (starting with = + - @, tab or CR) is prefixed with `'` so it stays plain text.
 */
export function leadsToCsv(leads: LeadData[]): string {
    const cell = (value: string) => {
        const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
        return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = leads.map((l) => [l.createdAt, l.kind, l.name, l.email, l.message, l.pagePath].map(cell).join(','));
    return ['"Date","Type","Name","Email","Message","Page"', ...rows].join('\r\n') + '\r\n';
}

/** Text safe inside HTML, and inert as email-template syntax (braces escaped too). */
const escapeHtml = (text: string) => text.replace(/[&<>"'{}]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * The notification email for a batch of new entries: a subject, plus an HTML header and body
 * for the mailer's default layout. Everything a visitor typed is escaped; the subject is one line.
 */
export function leadDigest(
    siteName: string,
    leads: LeadData[],
    inboxUrl?: string,
): { subject: string; header: string; body: string } {
    const first = leads[0];
    const what =
        leads.length > 1
            ? `${leads.length} new form entries`
            : first?.kind === 'signup'
              ? `new signup: ${first.email}`
              : `new message from ${first?.name || first?.email}`;
    const subject = `${siteName}: ${what}`.replace(/[\r\n{}]+/g, ' ').slice(0, 200);
    const items = leads.map((l) => {
        const who = l.kind === 'signup' ? 'Signup' : escapeHtml(l.name);
        const email = escapeHtml(l.email);
        const message = l.message ? `<p style="margin:8px 0 0;white-space:pre-wrap">${escapeHtml(l.message)}</p>` : '';
        return (
            `<div style="margin:0 0 16px;padding:16px;border:1px solid #e5e7eb;border-radius:8px">` +
            `<p style="margin:0"><strong>${who}</strong> · <a href="mailto:${email}">${email}</a></p>` +
            `<p style="margin:4px 0 0;color:#6b7280;font-size:13px">${escapeHtml(l.pagePath)} · ${escapeHtml(new Date(l.createdAt).toUTCString())}</p>` +
            `${message}</div>`
        );
    });
    const footer = inboxUrl ? `<p><a href="${escapeHtml(inboxUrl)}">Open the inbox</a></p>` : '';
    const header = `<h2 style="margin:0;font-size:18px">${escapeHtml(siteName)}: ${leads.length === 1 ? 'a new form entry' : `${leads.length} new form entries`}</h2>`;
    return { subject, header, body: items.join('') + footer };
}
