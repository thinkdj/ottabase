import type { ModelRLSConfig } from '@ottabase/ottaorm';
import { RLSPolicies } from '@ottabase/ottaorm';

/**
 * Homepage models follow hierarchical (tenant + user + app) scoping.
 * Admin users manage homepage content within their organization context.
 */

export const homepageSectionPolicy: ModelRLSConfig = {
    model: 'homepage_sections',
    policy: RLSPolicies.Hierarchical(false),
    contextFields: ['organizationId', 'appId', 'userId'],
    auditEnabled: true,
};

export const homepageFeaturePolicy: ModelRLSConfig = {
    model: 'homepage_features',
    policy: RLSPolicies.Hierarchical(false),
    contextFields: ['organizationId', 'appId', 'userId'],
    auditEnabled: true,
};

export const homepageActionPolicy: ModelRLSConfig = {
    model: 'homepage_actions',
    policy: RLSPolicies.Hierarchical(false),
    contextFields: ['organizationId', 'appId', 'userId'],
    auditEnabled: true,
};

export const homepageDisplaySettingsPolicy: ModelRLSConfig = {
    model: 'homepage_display_settings',
    policy: RLSPolicies.Hierarchical(false),
    contextFields: ['organizationId', 'appId', 'userId'],
    auditEnabled: true,
};
