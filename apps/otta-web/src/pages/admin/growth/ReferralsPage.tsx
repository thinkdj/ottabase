import { ReferralDashboard } from '@/components/ReferralDashboard';
import { useSession } from '@/lib/auth';
import { Button } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';

export function AdminReferralsPage() {
    const { isAuthenticated, user } = useSession({ skipAutoSync: true });

    if (!isAuthenticated || !user) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl bg-muted/40 px-6 py-12 text-center">
                <div className="space-y-1.5">
                    <h2 className="text-[0.9375rem] font-semibold">Authentication Required</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        Please log in to view referral tracking.
                    </p>
                </div>
                <Button asChild>
                    <Link to="/login">Login</Link>
                </Button>
            </div>
        );
    }

    return <ReferralDashboard userId={user.id} />;
}
