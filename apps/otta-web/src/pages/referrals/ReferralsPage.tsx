/**
 * Referrals Page
 *
 * Protected page that shows the referral dashboard for the authenticated user.
 */

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ReferralDashboard } from '@/components/ReferralDashboard';
import { useSession } from '@/lib/auth';
import { LoadingState } from '@ottabase/ui-components';

export function ReferralsPage() {
    const { user } = useSession();

    return (
        <ProtectedRoute>
            {user?.id ? <ReferralDashboard userId={user.id} /> : <ReferralsLoadingSkeleton />}
        </ProtectedRoute>
    );
}

/** Quiet placeholder shown while the session user resolves — mirrors the dashboard's stat-card + list shape. */
function ReferralsLoadingSkeleton() {
    return (
        <div className="space-y-8" aria-busy="true">
            <span className="sr-only">Loading referral dashboard...</span>
            <div className="grid gap-4 sm:grid-cols-3">
                <LoadingState count={3} height="h-24" />
            </div>
            <LoadingState count={1} height="h-40" />
        </div>
    );
}
