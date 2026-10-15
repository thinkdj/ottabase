import { definePackage, type OttaPackage, type PackageExtras } from '@ottabase/kernel';
import { ReferralTracking, referralTrackingTable } from './ottaorm-models/ReferralTracking';

export const REFERRALS_PACKAGE_KEY = 'referrals';

export type ReferralsPackageOptions<Env> = PackageExtras<Env>;

/** The referrals package as the app registers it: the tracking table and model, plus the host's routes. */
export function createReferralsPackage<Env = unknown>(options: ReferralsPackageOptions<Env> = {}): OttaPackage<Env> {
    return definePackage<Env>({
        key: REFERRALS_PACKAGE_KEY,
        name: 'Referrals',
        version: '1.0.0',
        description: 'Referral usernames, attribution tracking and conversion statistics.',
        tables: { referralTrackingTable },
        models: [ReferralTracking],
        ...options,
    });
}
