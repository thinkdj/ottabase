import type { LegalSection } from '../types';

/** Acceptable Use Policy. Referenced by the Terms of Service. The API row follows `features.api`. */
export const ACCEPTABLE_USE: LegalSection[] = [
    {
        id: 'intro',
        body: 'This Acceptable Use Policy describes what is and is not allowed on {{appName}}. It forms part of our [Terms of Service]({{legalBase}}/terms), and by using the Service you agree to it. It applies to everything you do with the Service, including content you store and the people you share it with.',
    },
    {
        id: 'prohibited',
        title: 'Prohibited uses',
        body: [
            'You may not use the Service to:',
            '',
            '- Break the law, or infringe the intellectual property, privacy or other rights of others;',
            '- Upload or distribute malware, or attempt to gain unauthorized access to any system, account or data;',
            '- Probe, scan or test the vulnerability of the Service, or circumvent its security or usage limits, other than through a responsible disclosure channel we publish;',
            '- Interfere with or disrupt the Service, including by excessive automated requests, scraping beyond what the Service offers for that purpose, or load that degrades it for others;',
            '- Send spam, phishing or other unsolicited or deceptive messages, or impersonate any person or organization;',
            '- Store or share content that is unlawful, defamatory, harassing, hateful, sexually exploitative, or harmful to minors, or that incites violence;',
            '- Reverse engineer, decompile or copy the Service except to the extent the law permits, or resell or sublicense it without our written agreement;',
            '- Use the Service to build a competing product by systematically extracting its content or functionality.',
        ].join('\n'),
    },
    {
        id: 'api',
        title: 'API and automation',
        when: (c) => !!c.features?.api,
        body: 'Automated access is allowed only through the API and integrations we provide, within their documented rate and usage limits, and with credentials issued to you. Do not share credentials, bypass limits, or use automation to collect data about other users.',
    },
    {
        id: 'enforcement',
        title: 'Enforcement',
        body: 'We may investigate suspected violations and take the action we consider appropriate, including removing content, limiting features, and suspending or terminating accounts, with notice where practical. We may also report illegal activity and cooperate with law enforcement where the law requires or allows it.',
    },
    {
        id: 'reporting',
        title: 'Reporting abuse',
        body: 'To report a violation of this policy, including content you believe infringes your rights, contact us at [{{contactEmail}}](mailto:{{contactEmail}}) with a link to the content and a description of the problem. We review every report.',
    },
];
