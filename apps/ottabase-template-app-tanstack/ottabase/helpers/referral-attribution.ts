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
    /** Click/conversion context — captured at signup time */
    ipAddress?: string | null;
    userAgent?: string | null;
    referer?: string | null;
    meta?: {
        utm?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
        headers?: Record<string, string>;
        [key: string]: unknown;
    } | null;
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
 * 3. Creates ReferralTracking record (status completed) with ipAddress, userAgent, referer, meta
 *
 * @param options - Attribution options (ipAddress, userAgent, referer, meta optional for conversion context)
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

        // 3. Create conversion record (clicks are in WAE; only conversions go to D1)
        // Capture full context — ipAddress, userAgent, referer, meta (UTM params, headers)
        await ReferralTracking.create({
            userId: referrerId,
            referralCode,
            referredUserId: newUserId,
            status: 'completed',
            conversionAt: Date.now(),
            ipAddress: options.ipAddress ?? null,
            userAgent: options.userAgent ?? null,
            referer: options.referer ?? null,
            meta: options.meta ?? null,
        });

        console.log(`Referral attribution successful: User ${newUserId} referred by ${referrerId} (${referralCode})`);

        return {
            attributed: true,
            referrerId,
            referralCode,
            trackingRecordsUpdated: 1,
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
