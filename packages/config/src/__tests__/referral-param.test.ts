import { describe, expect, it } from 'vitest';
import { defineOttabaseConfig } from '../defineOttabaseConfig';
import { DEFAULT_REFERRAL_PARAM, normalizeReferralParam } from '../ottabase-types';
import { resolveConfigWithEnv } from '../resolveConfigWithEnv';

const baseInput = { appId: 'test-app', appName: 'Test App' };

describe('referralParam configuration', () => {
    describe('normalizeReferralParam', () => {
        it('keeps valid url-safe keys', () => {
            expect(normalizeReferralParam('ref')).toBe('ref');
            expect(normalizeReferralParam('invite')).toBe('invite');
            expect(normalizeReferralParam('r')).toBe('r');
            expect(normalizeReferralParam('ref_code')).toBe('ref_code');
            expect(normalizeReferralParam('ref-code')).toBe('ref-code');
        });

        it('trims surrounding whitespace', () => {
            expect(normalizeReferralParam('  invite  ')).toBe('invite');
        });

        it('falls back to the default for unsafe or empty values', () => {
            expect(normalizeReferralParam('')).toBe(DEFAULT_REFERRAL_PARAM);
            expect(normalizeReferralParam('   ')).toBe(DEFAULT_REFERRAL_PARAM);
            expect(normalizeReferralParam('has space')).toBe(DEFAULT_REFERRAL_PARAM);
            expect(normalizeReferralParam('a=b')).toBe(DEFAULT_REFERRAL_PARAM);
            expect(normalizeReferralParam('a&b')).toBe(DEFAULT_REFERRAL_PARAM);
            expect(normalizeReferralParam('a?b')).toBe(DEFAULT_REFERRAL_PARAM);
            expect(normalizeReferralParam(undefined)).toBe(DEFAULT_REFERRAL_PARAM);
            expect(normalizeReferralParam(null)).toBe(DEFAULT_REFERRAL_PARAM);
        });
    });

    describe('defineOttabaseConfig', () => {
        it('defaults referralParam to "ref"', () => {
            const cfg = defineOttabaseConfig(baseInput);
            expect(cfg.features.referrals.referralParam).toBe('ref');
        });

        it('accepts a custom referralParam', () => {
            const cfg = defineOttabaseConfig({
                ...baseInput,
                features: { referrals: { enabled: true, trackClicks: true, expiryDays: 90, referralParam: 'invite' } },
            });
            expect(cfg.features.referrals.referralParam).toBe('invite');
        });

        it('normalizes an invalid referralParam back to the default', () => {
            const cfg = defineOttabaseConfig({
                ...baseInput,
                features: { referrals: { referralParam: 'bad key!' } as any },
            });
            expect(cfg.features.referrals.referralParam).toBe('ref');
        });
    });

    describe('resolveConfigWithEnv', () => {
        it('lets REFERRAL_PARAM override the config value', () => {
            const cfg = defineOttabaseConfig(baseInput);
            const resolved = resolveConfigWithEnv(cfg, { REFERRAL_PARAM: 'r' });
            expect(resolved.features.referrals.referralParam).toBe('r');
        });

        it('normalizes an unsafe REFERRAL_PARAM env value', () => {
            const cfg = defineOttabaseConfig(baseInput);
            const resolved = resolveConfigWithEnv(cfg, { REFERRAL_PARAM: 'not ok' });
            expect(resolved.features.referrals.referralParam).toBe('ref');
        });

        it('keeps the config value when no env override is present', () => {
            const cfg = defineOttabaseConfig({
                ...baseInput,
                features: { referrals: { referralParam: 'invite' } as any },
            });
            const resolved = resolveConfigWithEnv(cfg, {});
            expect(resolved.features.referrals.referralParam).toBe('invite');
        });
    });
});
