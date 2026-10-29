// Referrals: table and model from the package; this app adds the API.
import { Router } from '@ottabase/ottarouter';
import { createReferralsPackage } from '@ottabase/referrals';
import { ctxOf, h } from '../../worker/lib/api-context';
import {
    handleReferralsAnalytics,
    handleReferralStats,
    handleReferralTrack,
    handleReferralTrackingList,
    handleReferralUser,
    handleReferralUsernameUpdate,
    handleReferralVanityRedirect,
} from '../../worker/routes/referrals';

export const referralsPackage = createReferralsPackage<CloudflareEnv>({
    routes: [
        {
            basePath: '/api/referrals',
            build: () =>
                new Router<CloudflareEnv>()
                    .get('/stats', h(handleReferralStats))
                    .get('/user', h(handleReferralUser))
                    .get('/tracking', h(handleReferralTrackingList))
                    .get('/analytics', h(handleReferralsAnalytics))
                    .post('/track', h(handleReferralTrack))
                    .put('/username', h(handleReferralUsernameUpdate)),
        },
        {
            // Shareable referral links: /r/{username} → 302 to /?ref={username}
            basePath: '/r',
            build: () =>
                new Router<CloudflareEnv>().get('/:username', (c) =>
                    handleReferralVanityRedirect(ctxOf(c), c.params.username),
                ),
        },
    ],
    env: {
        optional: [
            {
                key: 'OBCF_ANALYTICS_REFERRALS',
                kind: 'binding',
                description: 'Analytics Engine dataset for referral events.',
            },
        ],
    },
});
