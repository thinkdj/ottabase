import { processReferralAttribution } from '../referral-attribution';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ottabase/ottaorm/models', () => ({
    User: {
        findByReferralUsername: vi.fn(),
        find: vi.fn(),
    },
}));

vi.mock('@ottabase/referrals', () => ({
    ReferralTracking: {
        create: vi.fn(),
    },
}));

const { User } = await import('@ottabase/ottaorm/models');
const { ReferralTracking } = await import('@ottabase/referrals');

describe('processReferralAttribution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns attributed: false when no referralCode', async () => {
        const result = await processReferralAttribution({ newUserId: 'u1', referralCode: '' });
        expect(result.attributed).toBe(false);
        expect(result.trackingRecordsUpdated).toBe(0);
        expect(User.findByReferralUsername).not.toHaveBeenCalled();
    });

    it('returns attributed: false when referrer not found', async () => {
        vi.mocked(User.findByReferralUsername).mockResolvedValue(null);
        const result = await processReferralAttribution({
            newUserId: 'u1',
            referralCode: 'unknown',
        });
        expect(result.attributed).toBe(false);
        expect(result.error).toBe('Referrer not found');
        expect(ReferralTracking.create).not.toHaveBeenCalled();
    });

    it('returns attributed: false on self-referral', async () => {
        const referrer = { get: (k: string) => (k === 'id' ? 'u1' : null) };
        vi.mocked(User.findByReferralUsername).mockResolvedValue(referrer as any);
        const result = await processReferralAttribution({
            newUserId: 'u1',
            referralCode: 'me',
        });
        expect(result.attributed).toBe(false);
        expect(result.error).toBe('Self-referral not allowed');
        expect(ReferralTracking.create).not.toHaveBeenCalled();
    });

    it('creates ReferralTracking with context when attribution succeeds', async () => {
        const referrer = { get: (k: string) => (k === 'id' ? 'ref-1' : null) };
        const newUser = { set: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
        vi.mocked(User.findByReferralUsername).mockResolvedValue(referrer as any);
        vi.mocked(User.find).mockResolvedValue(newUser as any);
        vi.mocked(ReferralTracking.create).mockResolvedValue({} as any);

        const result = await processReferralAttribution({
            newUserId: 'u1',
            referralCode: 'johndoe',
            ipAddress: '1.2.3.4',
            userAgent: 'Mozilla/5.0',
            referer: 'https://twitter.com/',
            meta: { utm: { source: 'twitter' }, headers: { 'accept-language': 'en' } },
        });

        expect(result.attributed).toBe(true);
        expect(result.trackingRecordsUpdated).toBe(1);
        expect(ReferralTracking.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'ref-1',
                referralCode: 'johndoe',
                referredUserId: 'u1',
                status: 'completed',
                ipAddress: '1.2.3.4',
                userAgent: 'Mozilla/5.0',
                referer: 'https://twitter.com/',
                meta: { utm: { source: 'twitter' }, headers: { 'accept-language': 'en' } },
            }),
        );
    });

    it('passes null for optional context when not provided', async () => {
        const referrer = { get: (k: string) => (k === 'id' ? 'ref-1' : null) };
        const newUser = { set: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
        vi.mocked(User.findByReferralUsername).mockResolvedValue(referrer as any);
        vi.mocked(User.find).mockResolvedValue(newUser as any);
        vi.mocked(ReferralTracking.create).mockResolvedValue({} as any);

        await processReferralAttribution({ newUserId: 'u1', referralCode: 'johndoe' });

        expect(ReferralTracking.create).toHaveBeenCalledWith(
            expect.objectContaining({
                ipAddress: null,
                userAgent: null,
                referer: null,
                meta: null,
            }),
        );
    });
});
