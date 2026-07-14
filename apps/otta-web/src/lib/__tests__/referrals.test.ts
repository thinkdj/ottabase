import { afterEach, describe, expect, it, vi } from 'vitest';

// Mutable stand-in for REFERRALS_CONFIG so each test can vary the configured key.
const { cfg } = vi.hoisted(() => ({
    cfg: { enabled: true, trackClicks: true, expiryDays: 90, referralParam: 'ref' } as {
        enabled: boolean;
        trackClicks: boolean;
        expiryDays: number;
        referralParam?: string;
    },
}));

vi.mock('@/ottabase/config', () => ({ REFERRALS_CONFIG: cfg }));
// referrals.ts imports './api' at module load; we never exercise it here.
vi.mock('../api', () => ({ api: vi.fn() }));

import { buildReferralLink, getReferralParamKey } from '../referrals';

afterEach(() => {
    cfg.referralParam = 'ref';
});

describe('referral param client helpers', () => {
    describe('getReferralParamKey', () => {
        it('defaults to "ref"', () => {
            expect(getReferralParamKey()).toBe('ref');
        });

        it('honors a configured key', () => {
            cfg.referralParam = 'invite';
            expect(getReferralParamKey()).toBe('invite');
        });

        it('falls back to "ref" when the config value is missing', () => {
            cfg.referralParam = undefined;
            expect(getReferralParamKey()).toBe('ref');
        });
    });

    describe('buildReferralLink', () => {
        it('uses the default param key', () => {
            expect(buildReferralLink('john', 'https://app.example.com')).toBe('https://app.example.com/?ref=john');
        });

        it('uses the configured param key', () => {
            cfg.referralParam = 'invite';
            expect(buildReferralLink('john', 'https://app.example.com')).toBe('https://app.example.com/?invite=john');
        });

        it('url-encodes the username', () => {
            expect(buildReferralLink('a b', 'https://x.com')).toBe('https://x.com/?ref=a+b');
        });
    });
});
