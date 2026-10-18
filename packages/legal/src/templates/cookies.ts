import type { LegalSection } from '../types';

/** Cookie Policy. Published only when `features.cookies` is set; the analytics row follows `features.analytics`. */
export const COOKIES: LegalSection[] = [
    {
        id: 'intro',
        body: 'This Cookie Policy explains how {{appName}} uses cookies and similar technologies, and the choices you have. It supplements our [Privacy Policy]({{legalBase}}/privacy).',
    },
    {
        id: 'what-are-cookies',
        title: 'What are cookies?',
        body: 'Cookies are small text files that a website stores on your device. We also use similar technologies such as local storage and session storage, which keep information in your browser. In this policy we call all of these "cookies". Some are set by us (first-party); some may be set by providers we use (third-party).',
    },
    {
        id: 'essential',
        title: 'Essential cookies',
        body: 'These are required for the Service to work. They sign you in and keep you signed in, protect against cross-site request forgery, remember choices you make such as language and theme, and balance load across our servers. They do not require consent, and the Service does not work without them.',
    },
    {
        id: 'analytics',
        title: 'Analytics cookies',
        when: (c) => !!c.features?.analytics,
        body: 'These help us understand how the Service is used, such as which pages are visited and where errors occur, so we can improve it. We use them in aggregate. Where the law requires it, we ask for your consent before setting them, and you can withdraw it at any time.',
    },
    {
        id: 'no-advertising',
        title: 'What we do not use',
        body: 'We do not use advertising or cross-site tracking cookies, and we do not sell information collected through cookies.',
    },
    {
        id: 'managing',
        title: 'Managing cookies',
        body: 'You can control and delete cookies through your browser settings; most browsers also let you block them for a site or in general. Blocking essential cookies will prevent you from signing in. Where we ask for consent to non-essential cookies, you can change your choice from the cookie settings in the Service.',
    },
    {
        id: 'changes',
        title: 'Changes to this policy',
        body: 'We may update this Cookie Policy from time to time, for example when we change the providers we use. It was last updated on {{lastUpdated}}.',
    },
    {
        id: 'contact',
        title: 'Contact us',
        body: 'Questions about cookies? Contact us at [{{contactEmail}}](mailto:{{contactEmail}}).',
    },
];
