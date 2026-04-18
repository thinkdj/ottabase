/**
 * Referrals Page
 *
 * Protected page that shows the referral dashboard for the authenticated user.
 */

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ReferralDashboard } from '@/components/ReferralDashboard';
import { useSession } from '@/lib/auth';

export function ReferralsPage() {
    const { user } = useSession({ skipAutoSync: true });

    return (
        <ProtectedRoute>
            {user?.id ? <ReferralDashboard userId={user.id} /> : <div className="p-4">Loading user data...</div>}
        </ProtectedRoute>
    );
}
