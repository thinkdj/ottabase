import { useApiQuery } from '@ottabase/ottaorm/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { CheckCircle, XCircle } from 'lucide-react';
import { Link } from '@tanstack/react-router';

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

interface TrackingListResponse {
    data: ReferralTrackingData[];
    total: number;
    page: number;
    perPage: number;
}

export function AdminReferralTrackingPage() {
    const { data: stats, isLoading: statsLoading } = useApiQuery<ReferralStats>({
        entity: 'referrals',
        queryKey: ['stats'],
        endpoint: '/api/referrals/stats',
    });

    const { data: trackingResponse, isLoading: trackingLoading } = useApiQuery<TrackingListResponse>({
        entity: 'referrals',
        queryKey: ['tracking', 'recent'],
        endpoint: '/api/referrals/tracking?page=1&perPage=20',
    });

    const recentTracking = trackingResponse?.data ?? [];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Referral Tracking</h1>
                <p className="text-muted-foreground mt-2">
                    Monitor referral clicks, conversions, and system performance.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{statsLoading ? '...' : (stats?.completed ?? 0)}</div>
                        <p className="text-xs text-muted-foreground">Successful signups from referrals</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Invalid</CardTitle>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{statsLoading ? '...' : (stats?.invalid ?? 0)}</div>
                        <p className="text-xs text-muted-foreground">Marked invalid</p>
                    </CardContent>
                </Card>

                <Card className="md:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Click Analytics</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link
                            to="/analytics"
                            search={{ tab: 'referrals' }}
                            className="text-sm font-medium text-primary hover:underline"
                        >
                            View analytics (WAE)
                        </Link>
                        <p className="text-xs text-muted-foreground mt-1">Clicks by country, code, day</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Conversions Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Conversions</CardTitle>
                    <CardDescription>Latest 20 referral conversions (D1); clicks are in WAE analytics</CardDescription>
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
                                        <th className="text-left py-3 px-4 text-sm font-medium">Converted</th>
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
                                                {tracking.conversionAt || tracking.createdAt
                                                    ? new Date(
                                                          tracking.conversionAt || tracking.createdAt,
                                                      ).toLocaleString()
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
