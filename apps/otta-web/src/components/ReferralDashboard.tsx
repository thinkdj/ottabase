/**
 * ReferralDashboard Component
 *
 * Displays referral stats, referral link, and allows users to manage their referral username.
 */

import { api } from '@/lib/api';
import { clearStoredReferralCode, getReferralExpiryInfo, getStoredReferralCode } from '@/lib/referrals';
import { validateReferralUsername } from '@ottabase/referrals';
import { ConfirmDialog } from '@ottabase/ui-components';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@ottabase/ui-shadcn';
import { Copy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ReferralStats {
    total: number;
    completed: number;
    pending: number;
}

interface ReferralUser {
    id: string;
    name?: string;
    email?: string;
    referralUsername?: string;
    referredById?: string;
}

interface ReferralData {
    user: ReferralUser;
    stats: ReferralStats;
}

interface TrackingData {
    data: any[];
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
    };
}

interface ReferralDashboardProps {
    userId: string;
}

export function ReferralDashboard({ userId }: ReferralDashboardProps) {
    const [data, setData] = useState<ReferralData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newUsername, setNewUsername] = useState('');
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);

    // Tracking pagination
    const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
    const [trackingPage, setTrackingPage] = useState(1);
    const [trackingLoading, setTrackingLoading] = useState(false);
    const trackingPerPage = 10;

    // Stored referral info (if user arrived via referral)
    const storedCode = getStoredReferralCode();
    const expiryInfo = getReferralExpiryInfo();

    useEffect(() => {
        loadData();
    }, [userId]);

    useEffect(() => {
        if (userId) {
            loadTrackingData();
        }
    }, [userId, trackingPage]);

    const loadData = async () => {
        try {
            setLoading(true);
            const result = await api<ReferralData>('/api/referrals/user');
            setData(result);
            setNewUsername(result.user.referralUsername || '');
            setError(null);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to load data';
            setError(errorMsg);
            // If API returns 404/empty, don't spam toast for normal empty state
            if (!/not found/i.test(errorMsg)) {
                toast.error(errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    const loadTrackingData = async () => {
        try {
            setTrackingLoading(true);
            const result = await api<TrackingData>(
                `/api/referrals/tracking?page=${trackingPage}&perPage=${trackingPerPage}`,
            );
            setTrackingData(result);
        } catch (err) {
            toast.error('Failed to load activity data');
            console.error(err);
            setTrackingData({
                data: [],
                pagination: { page: trackingPage, perPage: trackingPerPage, total: 0, totalPages: 1 },
            });
        } finally {
            setTrackingLoading(false);
        }
    };

    const handleUpdateUsername = async () => {
        const trimmed = newUsername.trim();
        // Validate
        const validation = validateReferralUsername(trimmed);
        if (!validation.valid) {
            setUsernameError(validation.error || 'Invalid username');
            return;
        }

        setUsernameError(null);
        setUpdating(true);

        try {
            await api('/api/referrals/username', {
                method: 'PUT',
                body: { referralUsername: trimmed },
            });

            await loadData();
            toast.success('Username updated successfully!');
        } catch (err: any) {
            const errorMsg =
                err?.message || err?.error || (err?.response?.error as string) || 'Failed to update username';
            setUsernameError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setUpdating(false);
        }
    };

    const handleCopyLink = () => {
        if (!data?.user.referralUsername) return;

        const link = `${window.location.origin}?ref=${data.user.referralUsername}`;
        navigator.clipboard.writeText(link);
        toast.success('Referral link copied to clipboard!');
    };

    const handleClearStoredReferral = () => {
        clearStoredReferralCode();
        window.location.reload();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">Loading referral data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <Card className="border-destructive">
                <CardContent className="pt-6">
                    <p className="text-destructive">Error: {error}</p>
                </CardContent>
            </Card>
        );
    }

    if (!data) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <p className="text-muted-foreground">No data available</p>
                </CardContent>
            </Card>
        );
    }

    const referralLink = data.user.referralUsername
        ? `${window.location.origin}?ref=${data.user.referralUsername}`
        : null;

    const totalPages = trackingData?.pagination.totalPages || 1;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Referral Dashboard</h1>
                <p className="text-muted-foreground mt-2">Manage your referral links and track conversions</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Total Clicks</CardDescription>
                        <CardTitle className="text-3xl">{data.stats.total}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Conversions</CardDescription>
                        <CardTitle className="text-3xl text-green-600">{data.stats.completed}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Pending</CardDescription>
                        <CardTitle className="text-3xl text-yellow-600">{data.stats.pending}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Username Management */}
            <Card>
                <CardHeader>
                    <CardTitle>Your Referral Username</CardTitle>
                    <CardDescription>Choose a unique username for your referral links</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder="e.g., johndoe"
                                className="flex-1"
                            />
                            <Button onClick={handleUpdateUsername} disabled={updating || !newUsername}>
                                {updating ? 'Updating...' : 'Update'}
                            </Button>
                        </div>
                        {usernameError && <p className="text-sm text-destructive">{usernameError}</p>}
                        <p className="text-sm text-muted-foreground">
                            3-20 characters, letters/numbers/underscore only
                        </p>
                    </div>

                    {data.user.referralUsername && (
                        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                            <CardContent className="pt-4">
                                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                    <strong>Warning:</strong> Changing your username will invalidate your old referral
                                    links and may affect pending conversions.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>

            {/* Referral Link */}
            {referralLink && (
                <Card>
                    <CardHeader>
                        <CardTitle>Your Referral Link</CardTitle>
                        <CardDescription>Share this link to earn referrals</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            <Input type="text" value={referralLink} readOnly />
                            <Button onClick={handleCopyLink} variant="secondary">
                                <Copy className="h-4 w-4 mr-2" />
                                Copy
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stored Referral Info (if user arrived via referral) */}
            {storedCode && (
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                    <CardHeader>
                        <CardTitle>You Were Referred!</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Referral Code</p>
                                <p className="font-medium font-mono">{storedCode}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Expires</p>
                                <p className="font-medium">{expiryInfo.expiresAt?.toLocaleDateString() || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Days Remaining</p>
                                <p className="font-medium">{expiryInfo.daysRemaining || 0}</p>
                            </div>
                        </div>

                        <ConfirmDialog
                            trigger={
                                <Button variant="destructive" size="sm">
                                    <X className="h-4 w-4 mr-2" />
                                    Clear Stored Referral
                                </Button>
                            }
                            title="Clear Stored Referral?"
                            description="This will remove the stored referral code from your browser. This action cannot be undone."
                            tone="destructive"
                            secondaryActionText="Cancel"
                            primaryActionText="Clear"
                            onConfirm={handleClearStoredReferral}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Recent Tracking with Pagination */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Your referral click and conversion history</CardDescription>
                </CardHeader>
                <CardContent>
                    {trackingLoading ? (
                        <div className="text-center py-6 text-muted-foreground">Loading activity...</div>
                    ) : !trackingData || trackingData.data.length === 0 ? (
                        <p className="text-center py-6 text-muted-foreground">No activity yet</p>
                    ) : (
                        <div className="space-y-4">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-2 text-sm font-medium">Status</th>
                                            <th className="text-left py-3 px-2 text-sm font-medium">IP Address</th>
                                            <th className="text-left py-3 px-2 text-sm font-medium">Created</th>
                                            <th className="text-left py-3 px-2 text-sm font-medium">Converted</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trackingData.data.map((track: any) => (
                                            <tr key={track.id} className="border-b hover:bg-muted/50">
                                                <td className="py-3 px-2">
                                                    <Badge
                                                        variant={
                                                            track.status === 'completed'
                                                                ? 'default'
                                                                : track.status === 'pending'
                                                                  ? 'secondary'
                                                                  : 'destructive'
                                                        }
                                                    >
                                                        {track.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-2 text-sm font-mono">
                                                    {track.ipAddress || '-'}
                                                </td>
                                                <td className="py-3 px-2 text-sm">
                                                    {new Date(track.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="py-3 px-2 text-sm">
                                                    {track.conversionAt
                                                        ? new Date(track.conversionAt).toLocaleDateString()
                                                        : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            <div className="flex items-center justify-between pt-4">
                                <p className="text-sm text-muted-foreground">
                                    Page {trackingData.pagination.page} of {trackingData.pagination.totalPages} (
                                    {trackingData.pagination.total} total)
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setTrackingPage((p) => p - 1)}
                                        disabled={trackingPage === 1}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setTrackingPage((p) => p + 1)}
                                        disabled={trackingPage === totalPages}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
