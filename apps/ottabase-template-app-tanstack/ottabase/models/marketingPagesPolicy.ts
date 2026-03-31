import type { ModelRLSConfig } from '@ottabase/ottaorm';
import { RLSPolicies } from '@ottabase/ottaorm';

const scopedPolicy = {
    policy: RLSPolicies.Hierarchical(false),
    contextFields: ['organizationId', 'appId', 'userId'],
    auditEnabled: true,
} as const;

export const marketingPagesPolicies: ModelRLSConfig[] = [
    {
        model: 'pages',
        ...scopedPolicy,
    },
    {
        model: 'page_sections',
        ...scopedPolicy,
    },
    {
        model: 'page_features',
        ...scopedPolicy,
    },
    {
        model: 'page_actions',
        ...scopedPolicy,
    },
];
