/**
 * Referrals Page
 *
 * Protected page that shows the referral dashboard for the authenticated user.
 */

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ReferralDashboard } from '@/components/ReferralDashboard';
import { useSession } from '@/lib/auth';

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
                {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/40" />
                ))}
            </div>
            <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
        </div>
    );
}
