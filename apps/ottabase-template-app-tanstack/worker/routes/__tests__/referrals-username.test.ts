import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleReferralUsernameUpdate } from '../referrals';

vi.mock('@ottabase/db/drizzle-d1', () => ({ createD1Driver: vi.fn() }));
vi.mock('@ottabase/ottaorm', () => ({ registerConnection: vi.fn() }));
vi.mock('@ottabase/auth/backend', () => ({ getSession: vi.fn() }));
vi.mock('../../lib/auth-utils', () => ({ getAuthOptions: vi.fn(() => ({})) }));
vi.mock('../../lib/utils', () => ({ readJson: vi.fn() }));
vi.mock('@ottabase/analytics/query', () => ({
    AnalyticsQueryError: class {},
    queryEvents: vi.fn(),
    validateAnalyticsConfig: vi.fn(),
}));
vi.mock('@ottabase/analytics/track', () => ({ trackEvent: vi.fn() }));
vi.mock('@ottabase/utils/pagination', () => ({
    parsePaginationParams: vi.fn(),
    paginatedJsonResponse: vi.fn(),
}));
vi.mock('@ottabase/referrals', () => ({
    validateReferralUsername: vi.fn(() => ({ valid: true })),
    ReferralTracking: { getStats: vi.fn(), forUser: vi.fn() },
}));
vi.mock('@ottabase/ottaorm/models', () => ({
    User: { findByReferralUsername: vi.fn(), find: vi.fn() },
}));
// Prevent Vite from trying to resolve email sub-path exports during test transform
vi.mock('@ottabase/email', () => ({
    createResendMailer: vi.fn(),
    createSESMailer: vi.fn(),
    sendTemplatedEmail: vi.fn(),
}));
vi.mock('@ottabase/email/providers/nodemailer', () => ({ createNodemailerMailer: vi.fn() }));
vi.mock('@ottabase/cf/kv-cache', () => ({ invalidateCacheByPrefix: vi.fn() }));

const { getSession } = await import('@ottabase/auth/backend');
const { readJson } = await import('../../lib/utils');
const { User } = await import('@ottabase/ottaorm/models');

function makeContext(envOverrides: Record<string, any> = {}, requestBody?: any) {
    const request = new Request('https://example.com/api/referrals/username', { method: 'PUT' });
    vi.mocked(readJson).mockResolvedValue(requestBody ?? { referralUsername: 'newname' });
    return {
        request,
        env: { OBCF_D1: {}, ...envOverrides } as any,
        url: new URL(request.url),
    };
}

function makeUser(overrides: Record<string, any> = {}) {
    const data: Record<string, any> = {
        id: 'user-1',
        referralUsername: null,
        referralUsernameChanges: 0,
        ...overrides,
    };
    return {
        get: vi.fn((key: string) => data[key]),
        set: vi.fn((key: string, value: any) => {
            data[key] = value;
        }),
        save: vi.fn().mockResolvedValue(undefined),
        toJson: vi.fn(() => data),
    };
}

describe('handleReferralUsernameUpdate – username change limit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getSession).mockResolvedValue({ user: { id: 'user-1' } } as any);
        vi.mocked(User.findByReferralUsername).mockResolvedValue(null);
    });

    it('allows first-time username setup without incrementing counter', async () => {
        const user = makeUser({ referralUsername: null, referralUsernameChanges: 0 });
        vi.mocked(User.find).mockResolvedValue(user as any);

        const res = await handleReferralUsernameUpdate(makeContext());
        expect(res.status).toBe(200);
        // counter should NOT be incremented for initial setup
        const setCallsForChanges = user.set.mock.calls.filter(([k]: [string]) => k === 'referralUsernameChanges');
        expect(setCallsForChanges).toHaveLength(0);
        expect(user.set).toHaveBeenCalledWith('referralUsername', 'newname');
    });

    it('allows a change when user has a username and is under the default limit (1)', async () => {
        const user = makeUser({ referralUsername: 'oldname', referralUsernameChanges: 0 });
        vi.mocked(User.find).mockResolvedValue(user as any);

        const res = await handleReferralUsernameUpdate(makeContext());
        expect(res.status).toBe(200);
        expect(user.set).toHaveBeenCalledWith('referralUsernameChanges', 1);
        expect(user.set).toHaveBeenCalledWith('referralUsername', 'newname');
    });

    it('blocks a change when the default limit (1) is reached', async () => {
        const user = makeUser({ referralUsername: 'oldname', referralUsernameChanges: 1 });
        vi.mocked(User.find).mockResolvedValue(user as any);

        const res = await handleReferralUsernameUpdate(makeContext());
        expect(res.status).toBe(400);
        const body = await res.json<any>();
        expect(body.code).toBe('USERNAME_CHANGE_LIMIT_REACHED');
    });

    it('respects a custom limit set via REFERRAL_SYSTEM_USERNAME_CHANGE=3', async () => {
        const user = makeUser({ referralUsername: 'oldname', referralUsernameChanges: 2 });
        vi.mocked(User.find).mockResolvedValue(user as any);

        const res = await handleReferralUsernameUpdate(makeContext({ REFERRAL_SYSTEM_USERNAME_CHANGE: '3' }));
        expect(res.status).toBe(200);
        expect(user.set).toHaveBeenCalledWith('referralUsernameChanges', 3);
    });

    it('blocks when custom limit (3) is exactly reached', async () => {
        const user = makeUser({ referralUsername: 'oldname', referralUsernameChanges: 3 });
        vi.mocked(User.find).mockResolvedValue(user as any);

        const res = await handleReferralUsernameUpdate(makeContext({ REFERRAL_SYSTEM_USERNAME_CHANGE: '3' }));
        expect(res.status).toBe(400);
        const body = await res.json<any>();
        expect(body.code).toBe('USERNAME_CHANGE_LIMIT_REACHED');
    });

    it('blocks all changes when limit is 0 (REFERRAL_SYSTEM_USERNAME_CHANGE=0)', async () => {
        const user = makeUser({ referralUsername: 'oldname', referralUsernameChanges: 0 });
        vi.mocked(User.find).mockResolvedValue(user as any);

        const res = await handleReferralUsernameUpdate(makeContext({ REFERRAL_SYSTEM_USERNAME_CHANGE: '0' }));
        expect(res.status).toBe(400);
        const body = await res.json<any>();
        expect(body.code).toBe('USERNAME_CHANGE_LIMIT_REACHED');
    });
});
