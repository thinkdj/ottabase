import type { ModelRLSConfig } from '@ottabase/ottaorm';
import { RLSPolicies } from '@ottabase/ottaorm';

/**
 * Homepage RLS policies.
 * Sections & display settings have an `appId` column → AppScoped.
 * Features & actions are child records (linked via sectionId, no scope columns) → AdminOnly.
 */

export const homepageSectionPolicy: ModelRLSConfig = {
    model: 'homepage_sections',
    policy: RLSPolicies.AdminOnly(),
    contextFields: [],
    auditEnabled: true,
};

export const homepageFeaturePolicy: ModelRLSConfig = {
    model: 'homepage_features',
    policy: RLSPolicies.AdminOnly(),
    contextFields: [],
    auditEnabled: true,
};

export const homepageActionPolicy: ModelRLSConfig = {
    model: 'homepage_actions',
    policy: RLSPolicies.AdminOnly(),
    contextFields: [],
    auditEnabled: true,
};

export const homepageDisplaySettingsPolicy: ModelRLSConfig = {
    model: 'homepage_display_settings',
    policy: RLSPolicies.AdminOnly(),
    contextFields: [],
    auditEnabled: true,
};
