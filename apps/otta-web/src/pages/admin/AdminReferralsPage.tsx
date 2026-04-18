import { ReferralDashboard } from '@/components/ReferralDashboard';
import { useSession } from '@/lib/auth';
import { Button } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';

export function AdminReferralsPage() {
    const { isAuthenticated, user } = useSession({ skipAutoSync: true });

    if (!isAuthenticated || !user) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
                <h2 className="text-2xl font-semibold">Authentication Required</h2>
                <p className="text-muted-foreground">Please log in to view referral tracking.</p>
                <Button asChild>
                    <Link to="/login">Login</Link>
                </Button>
            </div>
        );
    }

    return <ReferralDashboard userId={user.id} />;
}
