import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleReferralVanityRedirect } from '../referrals';

const mocks = vi.hoisted(() => ({
    findByReferralUsername: vi.fn(),
    referrals: { enabled: true, referralParam: 'ref' },
}));

vi.mock('@ottabase/db/drizzle-d1', () => ({ createD1Driver: vi.fn(() => ({})) }));
vi.mock('@ottabase/ottaorm', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ottabase/ottaorm')>()),
    registerConnection: vi.fn(),
}));
vi.mock('@ottabase/ottaorm/models', () => ({ User: { findByReferralUsername: mocks.findByReferralUsername } }));
vi.mock('../../../ottabase/config.loader', () => ({
    getOttabaseConfig: vi.fn(() => ({ features: { referrals: mocks.referrals } })),
}));

const redirect = (path: string, username: string) => {
    const url = new URL('https://app.test' + path);
    return handleReferralVanityRedirect({ request: new Request(url), env: { OBCF_D1: {} } as any, url }, username);
};

describe('GET /r/{username}', () => {
    beforeEach(() => {
        mocks.referrals = { enabled: true, referralParam: 'ref' };
        mocks.findByReferralUsername.mockReset();
        mocks.findByReferralUsername.mockResolvedValue({ get: () => 'jane' });
    });

    it('302s home with the configured param, keeping the sharer’s other params', async () => {
        mocks.referrals.referralParam = 'invite';
        const res = await redirect('/r/jane?utm_source=x', 'jane');
        expect(res!.status).toBe(302);
        expect(res!.headers.get('location')).toBe('https://app.test/?utm_source=x&invite=jane');
    });

    it('falls through for an unknown username', async () => {
        mocks.findByReferralUsername.mockResolvedValue(null);
        expect(await redirect('/r/nobody', 'nobody')).toBeNull();
    });

    it('falls through without a DB lookup for malformed usernames or when referrals are off', async () => {
        expect(await redirect('/r/x', 'a-b')).toBeNull();
        mocks.referrals.enabled = false;
        expect(await redirect('/r/jane', 'jane')).toBeNull();
        expect(mocks.findByReferralUsername).not.toHaveBeenCalled();
    });
});
