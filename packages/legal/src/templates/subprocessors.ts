import type { LegalSection } from '../types';

/**
 * Sub-processors. Published when `subProcessors` are configured or `features.eu` is set. The list renders from
 * `config.subProcessors` through `{{subProcessorList}}`, so there is one source of truth.
 */
export const SUBPROCESSORS: LegalSection[] = [
    {
        id: 'intro',
        body: 'To provide {{appName}}, {{companyName}} relies on the third-party service providers ("sub-processors") listed below. Each processes personal data on our behalf, only for the purpose stated, and under a contract that requires it to protect the data at least as well as we do. This page supplements our [Privacy Policy]({{legalBase}}/privacy).',
    },
    {
        id: 'list',
        title: 'Current sub-processors',
        when: (c) => !!c.subProcessors?.length,
        body: '{{subProcessorList}}',
    },
    {
        id: 'list-empty',
        title: 'Current sub-processors',
        when: (c) => !c.subProcessors?.length,
        body: 'We will publish the list of our sub-processors here. Until then, contact [{{privacyEmail}}](mailto:{{privacyEmail}}) for the current list.',
    },
    {
        id: 'changes',
        title: 'Changes to this list',
        body: 'We update this page when we add or replace a sub-processor. Where we are required to, we give notice before a new sub-processor processes your data, so you can object. This list was last updated on {{lastUpdated}}.',
    },
    {
        id: 'contact',
        title: 'Contact us',
        body: 'Questions about our sub-processors? Contact [{{privacyEmail}}](mailto:{{privacyEmail}}).',
    },
];
