import { User } from '@ottabase/ottaorm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReferralTracking } from './ReferralTracking';

describe('ReferralTracking static query helpers', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('forUser builds base query and sort options', async () => {
        const whereSpy = vi.spyOn(ReferralTracking, 'where').mockResolvedValue([]);

        await ReferralTracking.forUser('user-1');

        expect(whereSpy).toHaveBeenCalledWith(
            { userId: 'user-1' },
            { orderBy: 'createdAt', orderDirection: 'desc', limit: undefined, offset: undefined },
        );
    });

    it('forUser includes optional status, limit, and offset', async () => {
        const whereSpy = vi.spyOn(ReferralTracking, 'where').mockResolvedValue([]);

        await ReferralTracking.forUser('user-1', { status: 'pending', limit: 5, offset: 10 });

        expect(whereSpy).toHaveBeenCalledWith(
            { userId: 'user-1', status: 'pending' },
            { orderBy: 'createdAt', orderDirection: 'desc', limit: 5, offset: 10 },
        );
    });

    it('getStats aggregates total/completed/pending counts', async () => {
        vi.spyOn(ReferralTracking, 'where').mockResolvedValue([
            { get: vi.fn().mockReturnValue('completed') } as any,
            { get: vi.fn().mockReturnValue('pending') } as any,
            { get: vi.fn().mockReturnValue('invalid') } as any,
            { get: vi.fn().mockReturnValue('completed') } as any,
        ]);

        await expect(ReferralTracking.getStats('user-1')).resolves.toEqual({
            total: 4,
            completed: 2,
            pending: 1,
        });
    });

    it('findPendingByCode filters by code and pending status', async () => {
        const whereSpy = vi.spyOn(ReferralTracking, 'where').mockResolvedValue([]);

        await ReferralTracking.findPendingByCode('code-123');

        expect(whereSpy).toHaveBeenCalledWith({
            referralCode: 'code-123',
            status: 'pending',
        });
    });

    it('recentConversions defaults to limit 10 and supports custom limit', async () => {
        const whereSpy = vi.spyOn(ReferralTracking, 'where').mockResolvedValue([]);

        await ReferralTracking.recentConversions();
        await ReferralTracking.recentConversions(3);

        expect(whereSpy).toHaveBeenNthCalledWith(
            1,
            { status: 'completed' },
            { orderBy: 'conversionAt', orderDirection: 'desc', limit: 10 },
        );
        expect(whereSpy).toHaveBeenNthCalledWith(
            2,
            { status: 'completed' },
            { orderBy: 'conversionAt', orderDirection: 'desc', limit: 3 },
        );
    });
});

describe('ReferralTracking instance methods', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('markCompleted updates fields and saves the model', async () => {
        const record = new ReferralTracking({
            data: { status: 'pending', userId: 'user-1', referralCode: 'code-1' },
        } as any);
        const saveSpy = vi.spyOn(record, 'save').mockResolvedValue(record as any);
        vi.spyOn(Date, 'now').mockReturnValue(123_456);

        await record.markCompleted('new-user-1');

        expect(record.get('status')).toBe('completed');
        expect(record.get('referredUserId')).toBe('new-user-1');
        expect(record.get('conversionAt')).toEqual(new Date(123_456));
        expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it('markInvalid updates status and saves the model', async () => {
        const record = new ReferralTracking({
            data: { status: 'pending', userId: 'user-1', referralCode: 'code-1' },
        } as any);
        const saveSpy = vi.spyOn(record, 'save').mockResolvedValue(record as any);

        await record.markInvalid();

        expect(record.get('status')).toBe('invalid');
        expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it('referrer and referredUser return null when ids are missing', async () => {
        const record = new ReferralTracking({
            data: { userId: '', referredUserId: null, referralCode: 'code-1' },
        } as any);

        await expect(record.referrer()).resolves.toBeNull();
        await expect(record.referredUser()).resolves.toBeNull();
    });

    it('referrer and referredUser load users when ids exist', async () => {
        const record = new ReferralTracking({
            data: { userId: 'referrer-1', referredUserId: 'new-user-1', referralCode: 'code-1' },
        } as any);
        const findSpy = vi.spyOn(User, 'find').mockResolvedValue({ id: 'user' } as any);

        await record.referrer();
        await record.referredUser();

        expect(findSpy).toHaveBeenNthCalledWith(1, 'referrer-1');
        expect(findSpy).toHaveBeenNthCalledWith(2, 'new-user-1');
    });

    it('isConverted returns true only for completed records with referred user', () => {
        const converted = new ReferralTracking({
            data: { status: 'completed', referredUserId: 'new-user-1', referralCode: 'code-1' },
        } as any);
        const notConvertedMissingUser = new ReferralTracking({
            data: { status: 'completed', referredUserId: '', referralCode: 'code-1' },
        } as any);
        const notConvertedStatus = new ReferralTracking({
            data: { status: 'pending', referredUserId: 'new-user-1', referralCode: 'code-1' },
        } as any);

        expect(converted.isConverted()).toBe(true);
        expect(notConvertedMissingUser.isConverted()).toBe(false);
        expect(notConvertedStatus.isConverted()).toBe(false);
    });

    it('getUtmParams returns metadata utm payload or empty object', () => {
        const withUtm = new ReferralTracking({
            data: {
                referralCode: 'code-1',
                meta: { utm: { source: 'newsletter', campaign: 'launch' } },
            },
        } as any);
        const withoutUtm = new ReferralTracking({
            data: { referralCode: 'code-1', meta: {} },
        } as any);

        expect(withUtm.getUtmParams()).toEqual({ source: 'newsletter', campaign: 'launch' });
        expect(withoutUtm.getUtmParams()).toEqual({});
    });

    it('getBrowserInfo detects browser and OS and handles missing user agent', () => {
        const chromeWindows = new ReferralTracking({
            data: { referralCode: 'code-1', userAgent: 'Chrome Windows' },
        } as any);
        const firefoxLinux = new ReferralTracking({
            data: { referralCode: 'code-1', userAgent: 'Firefox Linux' },
        } as any);
        const safariMac = new ReferralTracking({
            data: { referralCode: 'code-1', userAgent: 'Safari Mac' },
        } as any);
        const edgeAndroid = new ReferralTracking({
            data: { referralCode: 'code-1', userAgent: 'Edge Android' },
        } as any);
        const unknown = new ReferralTracking({
            data: { referralCode: 'code-1' },
        } as any);

        expect(chromeWindows.getBrowserInfo()).toEqual({ browser: 'Chrome', os: 'Windows' });
        expect(firefoxLinux.getBrowserInfo()).toEqual({ browser: 'Firefox', os: 'Linux' });
        expect(safariMac.getBrowserInfo()).toEqual({ browser: 'Safari', os: 'macOS' });
        expect(edgeAndroid.getBrowserInfo()).toEqual({ browser: 'Edge', os: 'Android' });
        expect(unknown.getBrowserInfo()).toEqual({});
    });
});
