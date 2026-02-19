/**
 * ReferralTracker Component
 *
 * Automatically tracks referral links when the ?ref parameter is present in the URL.
 * Place this component at the root of your app to enable referral tracking.
 *
 * Configuration options (via app.config.ts):
 * - enabled: Enable/disable the entire referral system
 * - trackClicks: Enable/disable click tracking (still tracks conversions)
 * - expiryDays: How long stored referral codes are valid
 */

import { cleanReferralFromUrl, getStoredReferralCode, storeReferralCode, trackReferralClick } from '@/lib/referrals';
import { REFERRALS_CONFIG } from '@/ottabase/config/app.config';
import { useEffect, useRef } from 'react';

export function ReferralTracker() {
    const hasTracked = useRef(false);

    // Check if referral system is enabled
    if (!REFERRALS_CONFIG?.enabled) {
        return null;
    }

    useEffect(() => {
        // Only run once
        if (hasTracked.current) return;
        hasTracked.current = true;

        // Check for ref parameter in URL
        const params = new URLSearchParams(window.location.search);
        const referralCode = params.get('ref');

        if (!referralCode) {
            // No referral code in URL
            return;
        }

        // Check if we already have a stored referral code
        const existingCode = getStoredReferralCode();

        if (existingCode) {
            // First-touch wins: do not re-track or overwrite local storage
            cleanReferralFromUrl();
            return;
        }

        // Store the referral code (first-touch)
        storeReferralCode(referralCode);

        // Optionally track the click in database
        if (REFERRALS_CONFIG?.trackClicks) {
            trackReferralClick(referralCode)
                .then((success) => {
                    if (success) {
                        console.log('Referral click tracked successfully');
                    }
                })
                .catch((error) => {
                    console.error('Failed to track referral click:', error);
                });
        } else {
            console.log('Click tracking disabled - referral code stored for conversion tracking only');
        }

        // Clean URL (remove ref parameter)
        cleanReferralFromUrl();
    }, []);

    // This component renders nothing
    return null;
}
