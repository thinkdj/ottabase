import { definePackage, type OttaPackage, type PackageExtras } from '@ottabase/kernel';
import { RLSPolicies, type ModelRLSConfig } from '@ottabase/ottaorm';
import { LandingLead } from './ottaorm-models/LandingLead';
import { LandingPage } from './ottaorm-models/LandingPage';
import { LandingSite } from './ottaorm-models/LandingSite';
import { landingLeadsTable, landingPagesTable, landingSitesTable } from './schema';

export const OTTALANDING_PACKAGE_KEY = 'ottalanding';

export type OttalandingPackageOptions<Env> = PackageExtras<Env>;

/** Landing content is app-scoped and edited by platform admins only; the public site reads D1 directly. */
export const ottalandingPolicies: ModelRLSConfig[] = ['landing_sites', 'landing_pages', 'landing_leads'].map(
    (model) => ({
        model,
        policy: { ...RLSPolicies.AppScoped(), requirePlatformAdmin: true },
        contextFields: ['appId'],
        auditEnabled: true,
    }),
);

/** The landing package as the app registers it: tables, models and policies, plus the host's admin routes. */
export function createOttalandingPackage<Env = unknown>(
    options: OttalandingPackageOptions<Env> = {},
): OttaPackage<Env> {
    return definePackage<Env>({
        key: OTTALANDING_PACKAGE_KEY,
        name: 'Landing site',
        version: '1.0.0',
        description: 'Database-backed marketing site: settings, navigation and every page as typed content.',
        tables: { landingSitesTable, landingPagesTable, landingLeadsTable },
        models: [LandingSite, LandingPage, LandingLead],
        policies: ottalandingPolicies,
        ...options,
    });
}
