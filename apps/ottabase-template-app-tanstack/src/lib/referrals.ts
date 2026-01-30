/**
 * Client-side referral tracking utilities
 *
 * Handles referral code storage, expiry, and tracking.
 */

import { REFERRALS_CONFIG } from '@/ottabase/config/app.config';
import { api } from './api';

// Local storage keys
const REFERRAL_CODE_KEY = 'ottabase_referralCode';
const REFERRAL_TIMESTAMP_KEY = 'ottabase_referralTimestamp';

// Calculate expiry based on config (with fallback)
const getReferralExpiryMs = () => {
    try {
        return (REFERRALS_CONFIG?.expiryDays || 90) * 24 * 60 * 60 * 1000;
    } catch {
        return 90 * 24 * 60 * 60 * 1000; // Default to 90 days
    }
};

/**
 * Check if a referral timestamp has expired based on app config
 */
function isReferralExpired(timestamp: number): boolean {
    return Date.now() - timestamp > getReferralExpiryMs();
}

/**
 * Get the stored referral code (if valid and not expired)
 */
export function getStoredReferralCode(): string | null {
    if (typeof window === 'undefined') return null;

    try {
        const code = localStorage.getItem(REFERRAL_CODE_KEY);
        const timestamp = localStorage.getItem(REFERRAL_TIMESTAMP_KEY);

        if (!code || !timestamp) {
            return null;
        }

        const timestampNum = parseInt(timestamp, 10);

        // Check if expired
        if (isReferralExpired(timestampNum)) {
            clearStoredReferralCode();
            return null;
        }

        return code;
    } catch (error) {
        console.error('Error reading referral code:', error);
        return null;
    }
}

/**
 * Store a referral code in local storage
 */
export function storeReferralCode(code: string): void {
    if (typeof window === 'undefined') return;

    try {
        // Only store if there's no existing code (first-touch wins)
        const existing = getStoredReferralCode();
        if (existing) {
            console.log('Referral code already stored (first-touch wins):', existing);
            return;
        }

        localStorage.setItem(REFERRAL_CODE_KEY, code);
        localStorage.setItem(REFERRAL_TIMESTAMP_KEY, Date.now().toString());

        console.log('Stored referral code:', code);
    } catch (error) {
        console.error('Error storing referral code:', error);
    }
}

/**
 * Clear stored referral code
 */
export function clearStoredReferralCode(): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.removeItem(REFERRAL_CODE_KEY);
        localStorage.removeItem(REFERRAL_TIMESTAMP_KEY);
    } catch (error) {
        console.error('Error clearing referral code:', error);
    }
}

/**
 * Track a referral click (sends to API)
 */
export async function trackReferralClick(referralCode: string, meta?: Record<string, any>): Promise<boolean> {
    try {
        const response: Response = await api('/api/referrals/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                referralCode,
                referer: typeof document !== 'undefined' ? document.referrer : undefined,
                meta: {
                    ...meta,
                    utm: extractUtmParams(),
                },
            }),
        });

        if (!response.ok) {
            console.error('Failed to track referral:', await response.text());
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error tracking referral:', error);
        return false;
    }
}

/**
 * Extract UTM parameters from URL
 */
export function extractUtmParams(): Record<string, string> {
    if (typeof window === 'undefined') return {};

    try {
        const params = new URLSearchParams(window.location.search);
        const utm: Record<string, string> = {};

        const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

        utmKeys.forEach((key) => {
            const value = params.get(key);
            if (value) {
                utm[key] = value;
            }
        });

        return utm;
    } catch (error) {
        console.error('Error extracting UTM params:', error);
        return {};
    }
}

/**
 * Remove ref parameter from URL (clean URL)
 */
export function cleanReferralFromUrl(): void {
    if (typeof window === 'undefined') return;

    try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('ref')) {
            url.searchParams.delete('ref');
            window.history.replaceState({}, '', url.toString());
        }
    } catch (error) {
        console.error('Error cleaning referral from URL:', error);
    }
}

/**
 * Get referral expiry info
 */
export function getReferralExpiryInfo(): {
    expiresAt: Date | null;
    daysRemaining: number | null;
    isExpired: boolean;
} {
    const timestamp = localStorage.getItem(REFERRAL_TIMESTAMP_KEY);

    if (!timestamp) {
        return {
            expiresAt: null,
            daysRemaining: null,
            isExpired: false,
        };
    }

    const timestampNum = parseInt(timestamp, 10);
    const expiresAt = new Date(timestampNum + getReferralExpiryMs());
    const daysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const expired = isReferralExpired(timestampNum);

    return {
        expiresAt,
        daysRemaining: expired ? 0 : Math.max(0, daysRemaining),
        isExpired: expired,
    };
}
