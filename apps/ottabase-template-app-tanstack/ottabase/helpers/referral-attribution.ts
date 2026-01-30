/**
 * Server-side Referral Attribution Helper
 *
 * This helper should be called during user creation to handle referral attribution.
 * Typically used in Auth.js callbacks or custom registration endpoints.
 */

import { User } from '@ottabase/ottaorm/models';
import { ReferralTracking } from '@ottabase/referrals';

export interface ReferralAttributionOptions {
    newUserId: string;
    referralCode: string;
}

export interface ReferralAttributionResult {
    attributed: boolean;
    referrerId?: string;
    referralCode?: string;
    trackingRecordsUpdated: number;
    error?: string;
}

/**
 * Process referral attribution for a newly created user
 *
 * This function:
 * 1. Looks up the referrer by referralUsername
 * 2. Sets the new user's referredById field
 * 3. Updates ReferralTracking records from pending to completed
 *
 * @param options - Attribution options
 * @returns Attribution result
 */
export async function processReferralAttribution(
    options: ReferralAttributionOptions,
): Promise<ReferralAttributionResult> {
    const { newUserId, referralCode } = options;

    try {
        // If no referral code, nothing to attribute
        if (!referralCode) {
            return {
                attributed: false,
                trackingRecordsUpdated: 0,
            };
        }

        // 1. Look up the referrer by referralUsername
        const referrer = await User.findByReferralUsername(referralCode);

        if (!referrer) {
            console.warn(`Referrer not found for code: ${referralCode}`);
            return {
                attributed: false,
                trackingRecordsUpdated: 0,
                error: 'Referrer not found',
            };
        }

        const referrerId = referrer.get('id');

        // Prevent self-referral
        if (referrerId === newUserId) {
            console.warn('Attempted self-referral');
            return {
                attributed: false,
                trackingRecordsUpdated: 0,
                error: 'Self-referral not allowed',
            };
        }

        // 2. Set the new user's referredById field
        const newUser = await User.find(newUserId);
        if (newUser) {
            newUser.set('referredById', referrerId);
            await newUser.save();
        }

        // 3. Update ReferralTracking records from pending to completed
        const pendingRecords = await ReferralTracking.findPendingByCode(referralCode);

        let updatedCount = 0;
        for (const record of pendingRecords) {
            await record.markCompleted(newUserId);
            updatedCount++;
        }

        console.log(`Referral attribution successful: User ${newUserId} referred by ${referrerId} (${referralCode})`);

        return {
            attributed: true,
            referrerId,
            referralCode,
            trackingRecordsUpdated: updatedCount,
        };
    } catch (error) {
        console.error('Error processing referral attribution:', error);
        return {
            attributed: false,
            trackingRecordsUpdated: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
