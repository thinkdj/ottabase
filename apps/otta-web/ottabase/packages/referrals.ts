// Referrals: table and model from the package; this app adds the API.
import { Router } from '@ottabase/ottarouter';
import { createReferralsPackage } from '@ottabase/referrals';
import { h } from '../../worker/lib/api-context';
import {
    handleReferralsAnalytics,
    handleReferralStats,
    handleReferralTrack,
    handleReferralTrackingList,
    handleReferralUser,
    handleReferralUsernameUpdate,
} from '../../worker/routes/referrals';

export const referralsPackage = createReferralsPackage<CloudflareEnv>({
    routes: {
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
    env: { optional: ['OBCF_ANALYTICS_REFERRALS'] },
});
