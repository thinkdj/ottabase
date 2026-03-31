/**
 * Page-related RLS Policies
 *
 * AdminOnly for all page entities.
 * Public read access is handled at the API route level.
 */
import type { ModelRLSConfig } from '@ottabase/ottaorm';
import { RLSPolicies } from '@ottabase/ottaorm';

/**
 * Pages RLS policy - AdminOnly
 */
export const pagePolicy: ModelRLSConfig = {
    model: 'pages',
    policy: RLSPolicies.AdminOnly(),
    contextFields: [],
    auditEnabled: true,
};

/**
 * PageSections RLS policy - AdminOnly
 */
export const pageSectionPolicy: ModelRLSConfig = {
    model: 'page_sections',
    policy: RLSPolicies.AdminOnly(),
    contextFields: [],
    auditEnabled: true,
};

/**
 * PageFeatures RLS policy - AdminOnly
 */
export const pageFeaturePolicy: ModelRLSConfig = {
    model: 'page_features',
    policy: RLSPolicies.AdminOnly(),
    contextFields: [],
    auditEnabled: true,
};

/**
 * PageActions RLS policy - AdminOnly
 */
export const pageActionPolicy: ModelRLSConfig = {
    model: 'page_actions',
    policy: RLSPolicies.AdminOnly(),
    contextFields: [],
    auditEnabled: true,
};
