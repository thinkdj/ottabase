/**
 * Referrals Page
 *
 * Protected page that shows the referral dashboard for the authenticated user.
 */

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ReferralDashboard } from '@/components/ReferralDashboard';

export function ReferralsPage() {
    return (
        <ProtectedRoute>
            <ReferralDashboard />
        </ProtectedRoute>
    );
}
