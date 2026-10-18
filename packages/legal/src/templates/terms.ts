import type { LegalSection } from '../types';

/**
 * Terms of Service. Clauses for billing, trials, lifetime purchases, user content, organizations, the API, AI and third
 * parties are toggled by feature flags so each app publishes only what applies to it.
 */
export const TERMS: LegalSection[] = [
    {
        id: 'intro',
        body: [
            'These Terms of Service (the "Terms") are a binding agreement between you and {{companyName}} ("we", "us" or "our"). They govern your access to and use of {{appName}} and the related websites, applications and services we provide (together, the "Service").',
            'By creating an account or using the Service you agree to these Terms and to our [Privacy Policy]({{legalBase}}/privacy). If you do not agree, do not use the Service. If you use the Service on behalf of a company or other legal entity, you represent that you have authority to bind that entity, and "you" refers to it.',
        ].join('\n\n'),
    },
    {
        id: 'eligibility',
        title: 'Eligibility and your account',
        body: [
            'You must be old enough to form a binding contract where you live to use the Service.',
            'You agree to provide accurate information when you register and to keep it up to date. You are responsible for safeguarding your credentials and for all activity under your account, whether or not you authorized it. Notify us promptly at [{{contactEmail}}](mailto:{{contactEmail}}) if you suspect unauthorized access.',
        ].join('\n\n'),
        when: (c) => !c.minimumAge,
    },
    {
        id: 'eligibility-age',
        title: 'Eligibility and your account',
        body: [
            'You must be at least {{minimumAge}} years old, and old enough to form a binding contract where you live, to use the Service.',
            'You agree to provide accurate information when you register and to keep it up to date. You are responsible for safeguarding your credentials and for all activity under your account, whether or not you authorized it. Notify us promptly at [{{contactEmail}}](mailto:{{contactEmail}}) if you suspect unauthorized access.',
        ].join('\n\n'),
        when: (c) => !!c.minimumAge,
    },
    {
        id: 'the-service',
        title: 'The Service',
        body: [
            '{{appName}} provides the features described at {{siteUrl}}. We may add, change or remove features over time, and we may release features in beta or preview form that are offered as is and may be changed or withdrawn.',
            'We work to keep the Service available and reliable, but we do not guarantee uninterrupted or error-free operation. We may suspend the Service for maintenance, and we will try to give notice when we can.',
        ].join('\n\n'),
    },
    {
        id: 'acceptable-use',
        title: 'Acceptable use',
        body: 'You agree to use the Service lawfully and not to misuse it. In particular you may not gain or attempt unauthorized access, interfere with the Service, scrape it beyond what it offers for that purpose, or infringe the rights of others. Our [Acceptable Use Policy]({{legalBase}}/acceptable-use) forms part of these Terms.',
    },
    {
        id: 'your-content',
        title: 'Your content',
        when: (c) => !!c.features?.userContent,
        body: [
            'You keep ownership of the content you create, upload or store in the Service ("Your Content"). You grant us a worldwide, non-exclusive, royalty-free license to host, store, reproduce, process, transmit and display Your Content solely as needed to operate, secure and improve the Service and to provide it to you and to the people you share it with. This license ends when Your Content is deleted from the Service, except for copies kept in routine backups for a limited time.',
            'You are responsible for Your Content and represent that you have the rights needed to use it with the Service. We may remove or disable access to content that violates these Terms or applicable law, and we may, but are not obliged to, review content.',
        ].join('\n\n'),
    },
    {
        id: 'organizations',
        title: 'Organizations and shared workspaces',
        when: (c) => !!c.features?.organizations,
        body: 'The Service lets you create or join an organization or shared workspace. Its administrators can manage members, access, billing and data within it, including data you contribute. If your account is managed by an organization, that organization is responsible for its use of the Service and may be able to access or remove your account and its data. Keep that in mind before adding content to a shared space.',
    },
    {
        id: 'intellectual-property',
        title: 'Our intellectual property',
        body: 'The Service, including its software, design, text, graphics and trademarks, is owned by {{companyName}} or its licensors and is protected by intellectual property laws. Subject to these Terms we grant you a limited, revocable, non-exclusive, non-transferable right to use the Service for its intended purpose. No other rights are granted. Feedback you give us may be used without obligation to you.',
    },
    {
        id: 'api',
        title: 'API and integrations',
        when: (c) => !!c.features?.api,
        body: 'Where we offer an API, keys or integrations, you may use them only as documented and within the rate and usage limits we set. You are responsible for keeping API credentials secret and for the applications that use them. We may change, limit or withdraw the API with reasonable notice where practical, and immediately where needed to protect the Service or its users.',
    },
    {
        id: 'billing',
        title: 'Subscriptions and billing',
        when: (c) => !!c.features?.paidPlans,
        body: [
            'Some features require a paid plan. Paid plans are billed in advance for each billing period (for example monthly or yearly) and renew automatically at the end of each period until cancelled. You authorize us and our payment processor to charge your payment method for each period, plus applicable taxes, which may be added where we are required to collect them.',
            'We may change prices. We will give you at least {{noticeDays}} days notice, and a price change takes effect at your next renewal after that notice. If you do not agree, cancel before the renewal. Cancellation and refunds are governed by our [Refund and Cancellation Policy]({{legalBase}}/refunds). If a payment fails we may retry it and, after notice, suspend paid features until it succeeds.',
        ].join('\n\n'),
    },
    {
        id: 'free-trial',
        title: 'Free trials',
        when: (c) => !!(c.features?.paidPlans && c.features?.freeTrial),
        body: 'Where we offer a free trial, paid features are available without charge for the trial period shown when you start it. Unless you cancel before the trial ends, your plan converts to a paid subscription and the payment method you provided is charged. We may limit trials to one per person or organization.',
    },
    {
        id: 'lifetime',
        title: 'Lifetime purchases',
        when: (c) => !!(c.features?.paidPlans && c.features?.lifetimePlans),
        body: 'A "lifetime" purchase is a one-time payment for access to the plan features it names for as long as we offer the Service, not a subscription and not for the lifetime of the buyer. It covers the Service as it exists and evolves at the plan level you bought, and may not include future products or add-ons that are priced separately. Lifetime access is personal to the account that bought it and is not transferable unless we agree otherwise.',
    },
    {
        id: 'third-party-services',
        title: 'Third-party services',
        when: (c) => !!(c.features?.ai || c.features?.analytics || c.features?.paidPlans),
        body: 'The Service relies on third-party providers, such as hosting, payment processing and AI providers, to deliver certain features. Their services are governed by their own terms and we are not responsible for them. How these providers handle your data is described in our [Privacy Policy]({{legalBase}}/privacy).',
    },
    {
        id: 'ai-output',
        title: 'AI features',
        when: (c) => !!c.features?.ai,
        body: 'Some features generate output with artificial intelligence. Output can be inaccurate, incomplete or unsuitable for your purpose, and similar or identical output may be produced for other users. Review it before relying on it, and do not treat it as professional advice. You are responsible for how you use it. You may not use AI features to develop a competing model or to produce content that breaches our [Acceptable Use Policy]({{legalBase}}/acceptable-use).',
    },
    {
        id: 'data-protection',
        title: 'Data protection',
        when: (c) => !!c.features?.eu,
        body: 'Where you use the Service to process personal data of others, you are the controller of that data and we process it on your behalf as your processor, in accordance with our [Privacy Policy]({{legalBase}}/privacy) and the list of [Sub-processors]({{legalBase}}/subprocessors). If you require a data processing agreement, contact us at [{{privacyEmail}}](mailto:{{privacyEmail}}).',
    },
    {
        id: 'disclaimers',
        title: 'Disclaimers',
        body: 'The Service is provided "as is" and "as available". To the maximum extent permitted by law we disclaim all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, title and non-infringement, and any warranty that the Service will be uninterrupted, secure or error-free. Some jurisdictions do not allow certain disclaimers, so some of these may not apply to you.',
    },
    {
        id: 'limitation-of-liability',
        title: 'Limitation of liability',
        body: 'To the maximum extent permitted by law, {{companyName}} and its officers, employees and suppliers will not be liable for any indirect, incidental, special, consequential or punitive damages, or for any loss of data, revenue, profits or goodwill, arising out of or in connection with the Service, even if advised of the possibility. Our total liability for all claims relating to the Service in any 12-month period is limited to the greater of the amount you paid us for the Service in the 12 months before the claim arose and USD 100. Nothing in these Terms limits liability that cannot be limited by law, including for death or personal injury caused by negligence, fraud, or the statutory rights of consumers.',
    },
    {
        id: 'indemnification',
        title: 'Indemnification',
        body: 'To the extent permitted by law, you agree to defend, indemnify and hold harmless {{companyName}} from claims, damages, liabilities and expenses, including reasonable legal fees, arising out of your use of the Service, your content, or your breach of these Terms or applicable law. This does not apply to consumers where the law does not allow it.',
    },
    {
        id: 'termination',
        title: 'Termination',
        body: 'You may stop using the Service and delete your account at any time. We may suspend or terminate your access, with notice where practical, if you breach these Terms, if your use creates risk or legal exposure for us or others, or if we discontinue the Service. On termination your right to use the Service ends. Where the law or our [Privacy Policy]({{legalBase}}/privacy) does not require otherwise, we delete or anonymize your account data within {{deletionDays}} days. Provisions that by their nature should survive termination, including ownership, disclaimers, limitation of liability and governing law, survive.',
    },
    {
        id: 'governing-law',
        title: 'Governing law and disputes',
        body: 'These Terms are governed by the laws of {{governingLaw}}, without regard to its conflict-of-laws rules. You agree to the exclusive jurisdiction of the courts located in {{jurisdiction}} for any dispute arising out of these Terms or the Service, except that either party may seek injunctive relief in any competent court. If you are a consumer, this does not deprive you of the protection of mandatory consumer laws, or of the courts, of the country where you live.',
    },
    {
        id: 'changes',
        title: 'Changes to these Terms',
        body: 'We may update these Terms from time to time. For a material change we will give at least {{noticeDays}} days notice, for example by email or a notice in the Service, before it takes effect; for other changes we update the date below. If you do not agree to a change, stop using the Service before it takes effect. Continued use after that date means you accept the updated Terms. These Terms were last updated on {{lastUpdated}}.',
    },
    {
        id: 'general',
        title: 'General',
        body: 'These Terms, with the policies they refer to, are the entire agreement between you and us about the Service. If a provision is found unenforceable, the rest remains in effect. A failure to enforce a provision is not a waiver of it. You may not assign these Terms without our consent; we may assign them to an affiliate or a successor. Neither party is liable for delay or failure caused by events beyond its reasonable control. Notices to you may be sent to the email address on your account.',
    },
    {
        id: 'contact',
        title: 'Contact us',
        body: [
            'Questions about these Terms? Contact us at [{{contactEmail}}](mailto:{{contactEmail}}).',
            '',
            '{{companyName}}  ',
            '{{companyAddress}}',
        ].join('\n'),
    },
];
