import type { ModelRLSConfig } from '@ottabase/ottaorm';
import { RLSPolicies } from '@ottabase/ottaorm';

function adminOnly(model: string): ModelRLSConfig {
    return {
        model,
        policy: RLSPolicies.AdminOnly(),
        auditEnabled: true,
    };
}

export const homepageSectionPolicy = adminOnly('homepage_sections');
export const homepageFeaturePolicy = adminOnly('homepage_features');
export const homepageActionPolicy = adminOnly('homepage_actions');
export const homepageDisplaySettingsPolicy = adminOnly('homepage_display_settings');
