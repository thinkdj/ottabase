/**
 * Analytics endpoints are system-admin only in every environment. Analytics Engine rows carry no
 * organization, so the totals are platform-wide, a tenant user must never read them. They used to
 * be open when ENVIRONMENT was "development" (the top-level wrangler.jsonc default), and later open
 * to any signed-in user.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminAccess = vi.hoisted(() => vi.fn());
vi.mock('../../lib/admin-guard', () => ({ requireAdminAccess }));

import { handleCoreAnalytics } from '../core-analytics';
import { handleReferralsAnalytics } from '../referrals';
import { handleShortlinksAnalytics } from '../shortlinks';

const env = {
    ENVIRONMENT: 'development',
    CLOUDFLARE_ACCOUNT_ID: 'acct',
    CLOUDFLARE_ANALYTICS_API_TOKEN: 'token',
} as unknown as CloudflareEnv;

function ctx(path: string) {
    const request = new Request(`http://localhost${path}`);
    return { request, env, url: new URL(request.url) } as any;
}

const handlers = [
    ['referrals', () => handleReferralsAnalytics(ctx('/api/referrals/analytics'))],
    ['shortlinks', () => handleShortlinksAnalytics(ctx('/api/shortlinks/analytics'))],
    ['core', () => handleCoreAnalytics(ctx('/api/analytics/core'))],
] as const;

describe('analytics endpoints auth', () => {
    beforeEach(() => {
        requireAdminAccess.mockReset();
    });

    it.each(handlers)('%s analytics refuses a signed-in non-admin, even in development', async (_name, call) => {
        requireAdminAccess.mockResolvedValue(new Response(null, { status: 403 }));
        const response = await call();
        expect(response.status).toBe(403);
        expect(requireAdminAccess).toHaveBeenCalledWith(expect.anything(), { scope: 'system' });
    });
});
