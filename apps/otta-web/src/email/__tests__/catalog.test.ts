import { renderEmail } from '@ottabase/email';
import { describe, expect, it } from 'vitest';
import { APP_EMAILS, appEmail, buildOrganizationInviteEmailContent, composeAppEmail } from '../catalog';
describe('the app email catalogue', () => {
    it('renders every email from its sample with nothing left unfilled', () => {
        for (const email of APP_EMAILS) {
            const { subject, html, text } = renderEmail(composeAppEmail(email.id, email.sample));
            expect(subject).toBe(email.sections(email.sample).subject);
            expect(html).not.toContain('{{');
            expect(html).toContain(email.sections(email.sample).header);
            expect(text).toBeTruthy();
            const link = email.sample.url ?? email.sample.destinationUrl;
            if (link) expect(html).toContain(link.replace(/&/g, '&amp;'));
        }
    });

    it('escapes ampersands in links and keeps mustaches in names as text', () => {
        const verify = composeAppEmail('verify-email', { url: 'https://x.test/verify?a=1&b=2' });
        expect(verify.variables.body).toContain('href="https://x.test/verify?a=1&amp;b=2"');
        const invite = composeAppEmail('organization-invite', {
            organizationName: '{{body}}',
            destinationUrl: 'https://x.test',
        });
        expect(invite.subject).not.toContain('{{');
        expect(renderEmail(invite).subject).toBe("You've been invited to join { {body}}");
    });

    it('tells an invitation from an added notice', () => {
        const invite = buildOrganizationInviteEmailContent({
            organizationName: 'Acme',
            destinationUrl: 'https://x.test/register',
            alreadyHasAccount: false,
        });
        const added = buildOrganizationInviteEmailContent({
            organizationName: 'Acme',
            destinationUrl: 'https://x.test/login',
            alreadyHasAccount: true,
        });
        expect(invite.body).toContain('Create your account');
        expect(added.body).toContain('Sign in');
        expect(appEmail('nope')).toBeUndefined();
    });
});
