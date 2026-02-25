/**
 * Tests for the 4 new referral features:
 *   1. generateReferralUsername (packages/referrals)
 *   2. Duplicate-click deduplication in handleReferralTrack
 *   3. CSV export via handleReferralExport
 *   4. /r/{username} vanity redirect via handleReferralVanityRedirect
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Shared mocks (all needed for referrals.ts top-level import resolution)
// ─────────────────────────────────────────────────────────────────────────────
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
vi.mock('@ottabase/utils/user', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@ottabase/utils/user')>();
    return { ...actual, validateUsername: vi.fn(() => ({ valid: true })) };
});
vi.mock('@ottabase/referrals', () => ({
    ReferralTracking: {
        getStats: vi.fn(),
        forUser: vi.fn(),
        create: vi.fn(),
    },
}));
vi.mock('@ottabase/ottaorm/models', () => ({
    User: { findByReferralUsername: vi.fn(), find: vi.fn() },
}));
vi.mock('@ottabase/email', () => ({
    createResendMailer: vi.fn(),
    createSESMailer: vi.fn(),
    sendTemplatedEmail: vi.fn(),
}));
vi.mock('@ottabase/email/providers/nodemailer', () => ({ createNodemailerMailer: vi.fn() }));
vi.mock('@ottabase/cf/kv-cache', () => ({ invalidateCacheByPrefix: vi.fn() }));

import { generateReferralUsername } from '@ottabase/referrals/validation';
import { handleReferralExport, handleReferralTrack, handleReferralVanityRedirect } from '../referrals';

const { getSession } = await import('@ottabase/auth/backend');
const { readJson } = await import('../../lib/utils');
const { User } = await import('@ottabase/ottaorm/models');
const { ReferralTracking } = await import('@ottabase/referrals');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function makeContext(overrides: Record<string, any> = {}, body?: any, headers?: Record<string, string>) {
    const request = new Request('https://example.com/api/referrals/track', {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '1.2.3.4', ...headers },
    });
    if (body !== undefined) vi.mocked(readJson).mockResolvedValue(body);
    return {
        request,
        env: { OBCF_D1: {}, ...overrides } as any,
        url: new URL(request.url),
    };
}

function makeUser(id: string, referralUsername: string, name?: string) {
    return {
        get: vi.fn((key: string) => ({ id, referralUsername, name: name ?? null })[key] ?? null),
        set: vi.fn(),
        save: vi.fn().mockResolvedValue(undefined),
        toJson: vi.fn(() => ({ id, referralUsername, name })),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 1: generateReferralUsername
// ─────────────────────────────────────────────────────────────────────────────
describe('generateReferralUsername', () => {
    it('extracts the email prefix', () => {
        expect(generateReferralUsername('john.doe@example.com')).toBe('john_doe');
    });

    it('lowercases the result', () => {
        expect(generateReferralUsername('JohnDoe@example.com')).toBe('johndoe');
    });

    it('replaces non-alphanumeric chars with underscores and collapses them', () => {
        expect(generateReferralUsername('hello+world@test.com')).toBe('hello_world');
    });

    it('pads a short prefix to the minimum length', () => {
        const result = generateReferralUsername('ab@x.com'); // prefix = 'ab' (length 2)
        expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('truncates a long prefix to 15 characters', () => {
        const result = generateReferralUsername('verylongemailprefix@example.com');
        expect(result.length).toBeLessThanOrEqual(15);
    });

    it('strips leading and trailing underscores', () => {
        const result = generateReferralUsername('+test+@example.com'); // prefix = '+test+'
        expect(result).not.toMatch(/^_|_$/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature 2: Duplicate-click deduplication
// ─────────────────────────────────────────────────────────────────────────────
describe('handleReferralTrack – deduplication', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(User.findByReferralUsername).mockResolvedValue(makeUser('ref-1', 'johndoe') as any);
    });

    it('counts the click when KV is not configured', async () => {
        vi.mocked(readJson).mockResolvedValue({ referralCode: 'johndoe' });
        const ctx = makeContext({ OBCF_D1: {} }); // no OBCF_KV
        const res = await handleReferralTrack(ctx);
        const body = await res.json<any>();
        expect(res.status).toBe(200);
        expect(body.tracking.recorded).toBe(true);
    });

    it('deduplicates when the same IP+code appears within the window', async () => {
        vi.mocked(readJson).mockResolvedValue({ referralCode: 'johndoe' });
        const mockKv = { get: vi.fn().mockResolvedValue('1'), put: vi.fn().mockResolvedValue(undefined) };
        const ctx = makeContext({ OBCF_D1: {}, OBCF_KV: mockKv });
        const res = await handleReferralTrack(ctx);
        const body = await res.json<any>();
        expect(res.status).toBe(200);
        expect(body.tracking.deduplicated).toBe(true);
        expect(body.tracking.recorded).toBe(false);
    });

    it('counts a first click and stores the dedup key', async () => {
        vi.mocked(readJson).mockResolvedValue({ referralCode: 'johndoe' });
        const putSpy = vi.fn().mockResolvedValue(undefined);
        const mockKv = { get: vi.fn().mockResolvedValue(null), put: putSpy };
        const ctx = makeContext({ OBCF_D1: {}, OBCF_KV: mockKv });
        const res = await handleReferralTrack(ctx);
        const body = await res.json<any>();
        expect(res.status).toBe(200);
        expect(body.tracking.recorded).toBe(true);
        // dedup key should have been stored
        await vi.waitFor(() => expect(putSpy).toHaveBeenCalled());
        const [key, , opts] = putSpy.mock.calls[0];
        expect(key).toContain('ref:dedup:');
        expect(opts.expirationTtl).toBe(20 * 60);
    });

    it('disables dedup when REFERRAL_DEDUP_WINDOW_MINUTES=0', async () => {
        vi.mocked(readJson).mockResolvedValue({ referralCode: 'johndoe' });
        const getSpy = vi.fn();
        const mockKv = { get: getSpy, put: vi.fn().mockResolvedValue(undefined) };
        const ctx = makeContext({ OBCF_D1: {}, OBCF_KV: mockKv, REFERRAL_DEDUP_WINDOW_MINUTES: '0' });
        const res = await handleReferralTrack(ctx);
        expect(res.status).toBe(200);
        expect(getSpy).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature 3: CSV export
// ─────────────────────────────────────────────────────────────────────────────
describe('handleReferralExport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getSession).mockResolvedValue({ user: { id: 'user-1' } } as any);
    });

    it('returns 401 without a session', async () => {
        vi.mocked(getSession).mockResolvedValue(null);
        const req = new Request('https://example.com/api/referrals/export?format=csv');
        const res = await handleReferralExport({ request: req, env: { OBCF_D1: {} } as any, url: new URL(req.url) });
        expect(res.status).toBe(401);
    });

    it('returns CSV with correct headers and rows', async () => {
        vi.mocked(ReferralTracking.forUser).mockResolvedValue([
            {
                toJson: () => ({
                    id: 'track-1',
                    referralCode: 'johndoe',
                    referredUserId: 'user-2',
                    status: 'completed',
                    ipAddress: '1.2.3.4',
                    userAgent: 'Chrome',
                    referer: 'https://twitter.com',
                    createdAt: '2025-01-01',
                    conversionAt: '2025-01-02',
                }),
            } as any,
        ]);

        const req = new Request('https://example.com/api/referrals/export?format=csv');
        const res = await handleReferralExport({ request: req, env: { OBCF_D1: {} } as any, url: new URL(req.url) });
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toContain('text/csv');
        expect(res.headers.get('Content-Disposition')).toContain('attachment');
        const text = await res.text();
        expect(text).toContain('id,referralCode');
        expect(text).toContain('track-1');
        expect(text).toContain('johndoe');
    });

    it('escapes commas in field values', async () => {
        vi.mocked(ReferralTracking.forUser).mockResolvedValue([
            {
                toJson: () => ({
                    id: '1',
                    referralCode: 'code,with,commas',
                    referredUserId: null,
                    status: 'pending',
                    ipAddress: null,
                    userAgent: null,
                    referer: null,
                    createdAt: null,
                    conversionAt: null,
                }),
            } as any,
        ]);
        const req = new Request('https://example.com/api/referrals/export?format=csv');
        const res = await handleReferralExport({ request: req, env: { OBCF_D1: {} } as any, url: new URL(req.url) });
        const text = await res.text();
        expect(text).toContain('"code,with,commas"');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature 4: /r/{username} vanity redirect
// ─────────────────────────────────────────────────────────────────────────────
describe('handleReferralVanityRedirect', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns null when user not found', async () => {
        vi.mocked(User.findByReferralUsername).mockResolvedValue(null);
        const url = new URL('https://example.com/r/unknownuser');
        const req = new Request(url);
        const res = await handleReferralVanityRedirect(
            { request: req, env: { OBCF_D1: {} } as any, url },
            'unknownuser',
        );
        expect(res).toBeNull();
    });

    it('returns an HTML page with OG meta and redirect', async () => {
        vi.mocked(User.findByReferralUsername).mockResolvedValue(makeUser('u-1', 'johndoe', 'John Doe') as any);
        const url = new URL('https://example.com/r/johndoe');
        const req = new Request(url);
        const res = await handleReferralVanityRedirect({ request: req, env: { OBCF_D1: {} } as any, url }, 'johndoe');
        expect(res).not.toBeNull();
        expect(res!.status).toBe(200);
        expect(res!.headers.get('Content-Type')).toContain('text/html');
        const html = await res!.text();
        expect(html).toContain('og:title');
        expect(html).toContain('John Doe');
        expect(html).toContain('/?ref=johndoe');
        expect(html).toContain('window.location.replace');
    });

    it('escapes HTML-special characters in the username/name', async () => {
        vi.mocked(User.findByReferralUsername).mockResolvedValue(
            makeUser('u-2', 'safe', '<script>alert(1)</script>') as any,
        );
        const url = new URL('https://example.com/r/safe');
        const req = new Request(url);
        const res = await handleReferralVanityRedirect({ request: req, env: { OBCF_D1: {} } as any, url }, 'safe');
        const html = await res!.text();
        // Raw <script> tag must NOT appear in the HTML output
        expect(html).not.toContain('<script>alert(1)</script>');
    });
});
