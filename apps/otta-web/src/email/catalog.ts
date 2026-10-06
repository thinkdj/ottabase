/**
 * The emails this app sends, in one place: what each one says, which template renders it, and
 * sample values for previews and test sends. The worker composes the real emails from here and
 * the admin's Email page renders every entry, so the gallery shows exactly what goes out.
 */
import type { TemplateVariables } from '@ottabase/email';
import { minimalistTemplate } from './templates/minimalist';
import { sanitizeBlockHtml, sanitizeInlineHtml, sanitizeUrl } from '@ottabase/utils/sanitize';
import { stripHtml } from '@ottabase/utils/string';

export type AppEmailId = 'verify-email' | 'password-reset' | 'organization-invite' | 'organization-added' | 'test';

/** The sections the app template lays out */
export interface AppEmailSections {
    subject: string;
    /** Plain text; the template escapes it */
    header: string;
    /** Sanitized HTML */
    body: string;
    /** Plain text; the template escapes it */
    footer?: string;
}

export interface AppEmail {
    id: AppEmailId;
    label: string;
    /** When it goes out */
    description: string;
    /** Example values for the preview and for test sends */
    sample: Record<string, string>;
    /** The sections for these values; the worker fills real ones, the gallery the sample */
    sections(values: Record<string, string>): AppEmailSections;
}

/** Every app email renders through this template, passed by value so nothing needs registering */
export const APP_EMAIL_TEMPLATE = minimalistTemplate;

/** A URL as an href value: sanitized, with ampersands escaped for the attribute */
const href = (url: string) => sanitizeUrl(url).replace(/&/g, '&amp;');

export function buildOrganizationInviteEmailContent(params: {
    organizationName: string;
    destinationUrl: string;
    alreadyHasAccount: boolean;
}): AppEmailSections {
    const organizationNameText = stripHtml(sanitizeInlineHtml(params.organizationName))
        .replace(/[\r\n]+/g, ' ')
        .trim()
        .slice(0, 200);
    const displayName = organizationNameText || 'your organization';
    const organizationNameHtml = displayName.replace(
        /[&<>"']/g,
        (character) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[character] as string,
    );
    const destinationUrl = sanitizeUrl(params.destinationUrl);
    const action = params.alreadyHasAccount ? 'Sign in' : 'Create your account';
    const lead = params.alreadyHasAccount
        ? `You've been added to <strong>${organizationNameHtml}</strong>. Sign in to get started.`
        : `You've been invited to join <strong>${organizationNameHtml}</strong>. Create an account with this email address to accept.`;

    return {
        subject: `You've been invited to join ${displayName}`,
        header: `Join ${displayName}`,
        body: sanitizeBlockHtml(`<p>${lead}</p><p><a href="${destinationUrl}">${action}</a></p>`),
    };
}

const SAMPLE_SITE = 'https://example.com';

export const APP_EMAILS: AppEmail[] = [
    {
        id: 'verify-email',
        label: 'Verify email',
        description: 'After signing up with a password, and whenever a verification link is requested again.',
        sample: { url: `${SAMPLE_SITE}/api/auth/verify-email?token=sample&email=ada%40example.com` },
        sections: ({ url }) => ({
            subject: 'Verify your email',
            header: 'Verify your email',
            body:
                '<p>Thanks for signing up. Verify your email to activate your account.</p>' +
                `<p><a href="${href(url)}">Verify email</a></p>` +
                '<p>If you did not create this account, you can ignore this email.</p>',
            footer: 'For security, this link expires in 24 hours.',
        }),
    },
    {
        id: 'password-reset',
        label: 'Password reset',
        description: 'When someone asks for a link to reset their password.',
        sample: { url: `${SAMPLE_SITE}/reset-password?token=sample&email=ada%40example.com` },
        sections: ({ url }) => ({
            subject: 'Reset your password',
            header: 'Reset your password',
            body:
                '<p>We received a request to reset your password.</p>' +
                `<p><a href="${href(url)}">Reset password</a></p>` +
                '<p>If you did not request a password reset, you can ignore this email.</p>',
            footer: 'This link expires in 60 minutes.',
        }),
    },
    {
        id: 'organization-invite',
        label: 'Organization invite',
        description: 'When an admin invites an email address that has no account yet.',
        sample: { organizationName: 'Acme', destinationUrl: `${SAMPLE_SITE}/register?email=ada%40example.com` },
        sections: ({ organizationName, destinationUrl }) =>
            buildOrganizationInviteEmailContent({ organizationName, destinationUrl, alreadyHasAccount: false }),
    },
    {
        id: 'organization-added',
        label: 'Added to an organization',
        description: 'When an admin adds someone who already has an account.',
        sample: { organizationName: 'Acme', destinationUrl: `${SAMPLE_SITE}/login?email=ada%40example.com` },
        sections: ({ organizationName, destinationUrl }) =>
            buildOrganizationInviteEmailContent({ organizationName, destinationUrl, alreadyHasAccount: true }),
    },
    {
        id: 'test',
        label: 'Test email',
        description: 'Sent from the Email page in admin to check delivery; nothing else sends it.',
        sample: {},
        sections: () => ({
            subject: 'Test email',
            header: 'Test email',
            body: '<p>Hello from Ottabase. If you can read this, delivery works.</p>',
            footer: 'Sent from the Email page in admin.',
        }),
    },
];

export const appEmail = (id: string) => APP_EMAILS.find((email) => email.id === id);

/** What to send: the template and its filled sections, ready for sendTemplatedEmail or renderEmail */
export function composeAppEmail(id: AppEmailId, values: Record<string, string>) {
    const sections = appEmail(id)!.sections(values);
    return {
        template: APP_EMAIL_TEMPLATE,
        // A subject is rendered as a template too; a name with mustaches must stay a name
        subject: sections.subject.replace(/\{\{/g, '{ {'),
        variables: { ...sections, footer: sections.footer ?? '' } as TemplateVariables,
    };
}
