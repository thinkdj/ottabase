import type { LegalSection } from '../types';

/**
 * Privacy Policy. GDPR (EU, UK, EEA), CCPA/CPRA (California), AI processing, cookies, analytics, email and payment
 * clauses are toggled by feature flags. The sub-processors list is linked when that document is published.
 */
export const PRIVACY: LegalSection[] = [
    {
        id: 'intro',
        body: [
            'This Privacy Policy explains how {{companyName}} ("we", "us" or "our") collects, uses, shares and protects personal data when you use {{appName}} and the related websites and services (together, the "Service"), and what rights you have over it.',
            '{{companyName}} is the controller of the personal data described here, except where you use the Service to process personal data of others, in which case you are the controller and we process it on your behalf.',
        ].join('\n\n'),
    },
    {
        id: 'data-we-collect',
        title: 'Data we collect',
        body: [
            'We collect the following personal data:',
            '',
            '- **Account data**: your name, email address, password hash or sign-in provider identifiers, and account settings.',
            '- **Content you provide**: the information you enter, create or upload while using the Service, and messages you send us.',
            '- **Usage and device data**: how you interact with the Service, pages and features used, timestamps, IP address, browser and device type, approximate location derived from the IP address, and crash or error reports.',
        ].join('\n'),
    },
    {
        id: 'data-payment',
        when: (c) => !!c.features?.paidPlans,
        body: '- **Payment data**: your plan, invoices and billing history. Card details are collected and stored by our payment processor, not by us; we receive the card type, last four digits and expiry only.',
    },
    {
        id: 'data-sources',
        body: 'We collect this data from you directly, automatically as you use the Service, and from the sign-in provider you choose, if you sign in with one.',
    },
    {
        id: 'how-we-use',
        title: 'How we use your data',
        body: [
            'We use personal data to:',
            '',
            '- Provide, operate, maintain and improve the Service and its features;',
            '- Create and secure your account, authenticate you, and prevent fraud and abuse;',
            '- Respond to your requests and provide support;',
            '- Send service messages such as security notices, receipts and changes to our terms;',
            '- Understand how the Service is used, in aggregate, so we can improve it;',
            '- Comply with legal obligations and enforce our terms.',
            '',
            'We do not sell personal data, and we do not use your content to serve advertising.',
        ].join('\n'),
    },
    {
        id: 'legal-bases',
        title: 'Legal bases for processing',
        when: (c) => !!c.features?.eu,
        body: [
            'If you are in the European Economic Area, the United Kingdom or Switzerland, we rely on the following legal bases:',
            '',
            '- **Performance of a contract**: to provide the Service you signed up for;',
            '- **Legitimate interests**: to secure, improve and understand the use of the Service, and to communicate with you about it, where those interests are not overridden by your rights;',
            '- **Consent**: where the law requires it, such as for non-essential cookies or marketing email. You may withdraw consent at any time;',
            '- **Legal obligation**: to keep records and respond to lawful requests.',
        ].join('\n'),
    },
    {
        id: 'ai-processing',
        title: 'AI features',
        when: (c) => !!c.features?.ai,
        body: [
            'Some features use artificial intelligence provided by third parties. When you use them, the content you submit for that feature, such as text or images, is sent to the provider to produce your result and is returned to the Service.',
            'Our agreements with these providers prohibit them from using your content to train their models and limit how long they may retain it. You can choose not to use AI features; the rest of the Service works without them.',
        ].join('\n\n'),
    },
    {
        id: 'ai-processing-providers',
        when: (c) => !!(c.features?.ai && (c.subProcessors?.length || c.features?.eu)),
        body: 'The AI providers we rely on are listed on our [Sub-processors]({{legalBase}}/subprocessors) page.',
    },
    {
        id: 'cookies',
        title: 'Cookies and similar technologies',
        when: (c) => !!c.features?.cookies,
        body: 'We use cookies and similar technologies, such as local storage, to keep you signed in, remember your preferences and understand how the Service is used. For details and your choices see our [Cookie Policy]({{legalBase}}/cookies).',
    },
    {
        id: 'analytics',
        title: 'Analytics',
        when: (c) => !!c.features?.analytics,
        body: 'We measure how the Service is used to find problems and improve it. We use this data in aggregate and keep it to what is needed for that purpose.',
    },
    {
        id: 'email',
        title: 'Communications',
        when: (c) => !!c.features?.email,
        body: 'We send service messages about your account, security and changes to our terms, which you cannot opt out of while you have an account. Where you have opted in, or where the law otherwise permits, we may also send product news and tips. Every such email includes an unsubscribe link, and you can change your preferences in your account settings at any time.',
    },
    {
        id: 'sharing',
        title: 'How we share data',
        body: [
            'We share personal data only:',
            '',
            '- **With service providers** that process it on our behalf and under our instructions, such as hosting, storage, email delivery, payment processing and support tooling, bound by contracts that protect it;',
            '- **With other users**, when you choose to share content or collaborate with them through the Service;',
            '- **With authorities or other parties**, when required by law, to respond to lawful requests, or to protect the rights, property or safety of you, us or others;',
            '- **With a successor**, in connection with a merger, acquisition, financing or sale of assets, in which case this policy continues to apply to your data until you are told otherwise.',
        ].join('\n'),
    },
    {
        id: 'sharing-subprocessors',
        when: (c) => !!(c.subProcessors?.length || c.features?.eu),
        body: 'Our current service providers are listed on our [Sub-processors]({{legalBase}}/subprocessors) page.',
    },
    {
        id: 'international-transfers',
        title: 'International transfers',
        when: (c) => !!c.features?.eu,
        body: "Your data may be processed in countries other than the one you live in, including countries whose laws offer a different level of protection. Where we transfer personal data out of the European Economic Area, the United Kingdom or Switzerland, we rely on an adequacy decision or on appropriate safeguards such as the European Commission's Standard Contractual Clauses and the UK Addendum, together with supplementary measures where needed. You can ask us for details of the safeguards we use.",
    },
    {
        id: 'retention',
        title: 'Data retention',
        body: 'We keep personal data for as long as your account is active and as needed to provide the Service. When you delete your account, or ask us to, we delete or anonymize your personal data within {{deletionDays}} days, except where we must keep it longer to meet legal, tax or accounting obligations, to resolve disputes or to enforce our agreements, and except for copies in routine backups that are overwritten on a fixed schedule. Usage data is kept in aggregate form only.',
    },
    {
        id: 'your-rights',
        title: 'Your rights',
        body: [
            'Depending on where you live, you may have the right to access the personal data we hold about you, to correct it, to receive a copy in a portable format, to have it deleted, to object to or restrict certain processing, and to withdraw consent where processing is based on it.',
            'You can access, update and export much of your data from your account settings. For anything else, contact us at [{{privacyEmail}}](mailto:{{privacyEmail}}). We will respond within the time the law requires, and we may need to verify your identity first. We will not treat you differently for exercising your rights.',
        ].join('\n\n'),
    },
    {
        id: 'your-rights-eu',
        when: (c) => !!c.features?.eu,
        body: 'If you are in the European Economic Area, the United Kingdom or Switzerland, you also have the right to lodge a complaint with your local data protection authority. We would appreciate the chance to address your concern first.',
    },
    {
        id: 'california',
        title: 'California privacy rights',
        when: (c) => !!c.features?.california,
        body: [
            'If you are a California resident, the California Consumer Privacy Act, as amended by the California Privacy Rights Act, gives you the right to know what personal information we collect, use and disclose, to request its deletion or correction, to opt out of its "sale" or "sharing", and to limit the use of sensitive personal information.',
            '**We do not sell or share personal information** as those terms are defined under California law, and we do not use or disclose sensitive personal information other than to provide the Service. The categories of personal information we collect, and their purposes and recipients, are described above. To exercise your rights, contact [{{privacyEmail}}](mailto:{{privacyEmail}}). You may use an authorized agent, and we will not discriminate against you for exercising your rights.',
        ].join('\n\n'),
    },
    {
        id: 'children',
        title: "Children's privacy",
        when: (c) => !c.features?.children,
        body: 'The Service is not directed to children under 13, or under the age at which parental consent is required where you live, and we do not knowingly collect personal data from them. If you believe a child has provided us personal data, contact us at [{{privacyEmail}}](mailto:{{privacyEmail}}) and we will delete it.',
    },
    {
        id: 'security',
        title: 'Security',
        body: 'We protect personal data with technical and organizational measures appropriate to the risk, including encryption in transit, encryption of stored secrets, access controls, least-privilege access for our staff, and logging. No method of transmission or storage is completely secure, so we cannot guarantee absolute security. If a breach affecting your data occurs, we will notify you and the relevant authorities as the law requires.',
    },
    {
        id: 'changes',
        title: 'Changes to this policy',
        body: 'We may update this Privacy Policy from time to time. For a material change we will give notice before it takes effect, for example by email or a notice in the Service; for other changes we update the date below. This policy was last updated on {{lastUpdated}}.',
    },
    {
        id: 'contact',
        title: 'Contact us',
        body: [
            'Questions or requests about your personal data? Contact us at [{{privacyEmail}}](mailto:{{privacyEmail}}).',
            '',
            '{{companyName}}  ',
            '{{companyAddress}}',
        ].join('\n'),
    },
];
