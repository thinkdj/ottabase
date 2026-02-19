import { useApiQuery } from '@ottabase/ottaorm/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Activity, CheckCircle, Clock, XCircle } from 'lucide-react';

interface ReferralStats {
    total: number;
    completed: number;
    pending: number;
    invalid: number;
}

interface ReferralTrackingData {
    id: string;
    userId: string;
    referralCode: string;
    referredUserId: string | null;
    status: 'pending' | 'completed' | 'invalid';
    ipAddress: string | null;
    userAgent: string | null;
    referer: string | null;
    createdAt: string;
    conversionAt: string | null;
}

export function AdminReferralTrackingPage() {
    const { data: stats, isLoading: statsLoading } = useApiQuery<ReferralStats>({
        entity: 'referrals',
        queryKey: ['stats'],
        endpoint: '/api/referrals/stats',
    });

    const { data: recentTracking, isLoading: trackingLoading } = useApiQuery<ReferralTrackingData[]>({
        entity: 'referrals',
        queryKey: ['tracking', 'recent'],
        endpoint: '/api/referrals/tracking/recent?limit=20',
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Referral Tracking</h1>
                <p className="text-muted-foreground mt-2">
                    Monitor referral clicks, conversions, and system performance.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{statsLoading ? '...' : stats?.total || 0}</div>
                        <p className="text-xs text-muted-foreground">All referral link clicks</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{statsLoading ? '...' : stats?.completed || 0}</div>
                        <p className="text-xs text-muted-foreground">Successful user signups</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{statsLoading ? '...' : stats?.pending || 0}</div>
                        <p className="text-xs text-muted-foreground">Awaiting conversion</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {statsLoading
                                ? '...'
                                : stats && stats.total > 0
                                  ? `${((stats.completed / stats.total) * 100).toFixed(1)}%`
                                  : '0%'}
                        </div>
                        <p className="text-xs text-muted-foreground">Clicks to conversions</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Tracking Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Referral Activity</CardTitle>
                    <CardDescription>Latest 20 referral clicks and conversions</CardDescription>
                </CardHeader>
                <CardContent>
                    {trackingLoading ? (
                        <div className="text-center py-6 text-muted-foreground">Loading tracking data...</div>
                    ) : !recentTracking || recentTracking.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">No referral activity yet.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4 text-sm font-medium">Status</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium">Code</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium">Referrer</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium">Referred User</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium">Click Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium">Conversion Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTracking.map((tracking) => (
                                        <tr key={tracking.id} className="border-b hover:bg-muted/50">
                                            <td className="py-3 px-4">
                                                {tracking.status === 'completed' ? (
                                                    <span className="inline-flex items-center gap-1 text-green-600">
                                                        <CheckCircle className="h-4 w-4" />
                                                        <span className="text-sm">Completed</span>
                                                    </span>
                                                ) : tracking.status === 'pending' ? (
                                                    <span className="inline-flex items-center gap-1 text-yellow-600">
                                                        <Clock className="h-4 w-4" />
                                                        <span className="text-sm">Pending</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-red-600">
                                                        <XCircle className="h-4 w-4" />
                                                        <span className="text-sm">Invalid</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sm font-mono">{tracking.referralCode}</td>
                                            <td className="py-3 px-4 text-sm font-mono text-muted-foreground">
                                                {tracking.userId.substring(0, 8)}...
                                            </td>
                                            <td className="py-3 px-4 text-sm font-mono text-muted-foreground">
                                                {tracking.referredUserId
                                                    ? `${tracking.referredUserId.substring(0, 8)}...`
                                                    : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-muted-foreground">
                                                {new Date(tracking.createdAt).toLocaleString()}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-muted-foreground">
                                                {tracking.conversionAt
                                                    ? new Date(tracking.conversionAt).toLocaleString()
                                                    : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
