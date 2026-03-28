import type { ModelRLSConfig } from '@ottabase/ottaorm';
import { RLSPolicies } from '@ottabase/ottaorm';

/**
 * Changelog entries follow the same tenant + user + app scoping as blog posts.
 */
export const changelogPolicy: ModelRLSConfig = {
    model: 'changelog_entries',
    policy: RLSPolicies.Hierarchical(false),
    contextFields: ['organizationId', 'appId', 'userId'],
    auditEnabled: true,
};
