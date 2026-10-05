/**
 * ReferralDashboard Component
 *
 * The referral link first, then stats, then the username it is built from and recent activity.
 */

import { api } from '@/lib/api';
import {
    buildReferralLink,
    clearStoredReferralCode,
    getReferralExpiryInfo,
    getStoredReferralCode,
} from '@/lib/referrals';
import { validateReferralUsername } from '@ottabase/referrals';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Alert,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
} from '@ottabase/ui-shadcn';
import { Copy, Share2, X } from 'lucide-react';
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

        const link = buildReferralLink(data.user.referralUsername);
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
        return <Alert variant="destructive">{error}</Alert>;
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

    const referralLink = data.user.referralUsername ? buildReferralLink(data.user.referralUsername) : null;
    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const handleShare = () => {
        if (!referralLink) return;
        navigator.share({ title: 'Join me', url: referralLink }).catch(() => {});
    };

    const totalPages = trackingData?.pagination.totalPages || 1;

    const usernameForm = (
        <div className="space-y-2">
            <div className="flex gap-2">
                <Input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. johndoe"
                    aria-label="Referral username"
                    className="flex-1"
                />
                <Button onClick={handleUpdateUsername} disabled={updating || !newUsername}>
                    {updating ? 'Saving…' : referralLink ? 'Change' : 'Create link'}
                </Button>
            </div>
            {usernameError && (
                <p role="alert" className="text-sm text-destructive">
                    {usernameError}
                </p>
            )}
            <p className="text-sm text-muted-foreground">3 to 20 characters: letters, numbers and underscores.</p>
        </div>
    );

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Referrals</h1>
                <p className="mt-2 text-muted-foreground">Share your link. Every sign-up through it counts as yours.</p>
            </div>

            {/* The link is the whole point, so it leads; without a username, picking one leads instead */}
            {referralLink ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Your link</CardTitle>
                        <CardDescription>Anyone who signs up through it is your referral.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 sm:flex-row">
                        <Input
                            type="text"
                            value={referralLink}
                            readOnly
                            aria-label="Referral link"
                            onFocus={(e) => e.currentTarget.select()}
                            className="font-mono text-sm"
                        />
                        <div className="flex shrink-0 gap-2">
                            <Button onClick={handleCopyLink}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy
                            </Button>
                            {canShare && (
                                <Button variant="outline" onClick={handleShare}>
                                    <Share2 className="mr-2 h-4 w-4" />
                                    Share
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Pick a username to get your link</CardTitle>
                        <CardDescription>Your link is built from it, so choose something easy to say.</CardDescription>
                    </CardHeader>
                    <CardContent>{usernameForm}</CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Clicks</CardDescription>
                        <CardTitle className="text-3xl">{data.stats.total}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Signed up</CardDescription>
                        <CardTitle className="text-3xl text-success">{data.stats.completed}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Pending</CardDescription>
                        <CardTitle className="text-3xl text-warning">{data.stats.pending}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {referralLink && (
                <Card>
                    <CardHeader>
                        <CardTitle>Username</CardTitle>
                        <CardDescription>Your link is built from it.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {usernameForm}
                        <Alert variant="warning">
                            Changing it breaks links you have already shared and may affect pending conversions.
                        </Alert>
                    </CardContent>
                </Card>
            )}

            {storedCode && (
                <Alert variant="info" className="space-y-3">
                    <p className="font-medium">You were referred</p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                            <p className="text-muted-foreground">Code</p>
                            <p className="font-mono font-medium">{storedCode}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Expires</p>
                            <p className="font-medium">{expiryInfo.expiresAt?.toLocaleDateString() || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Days left</p>
                            <p className="font-medium">{expiryInfo.daysRemaining || 0}</p>
                        </div>
                    </div>
                    <ConfirmDialog
                        trigger={
                            <Button variant="outline" size="sm">
                                <X className="mr-2 h-4 w-4" />
                                Forget this referral
                            </Button>
                        }
                        title="Forget this referral?"
                        description="The stored referral code is removed from this browser. This cannot be undone."
                        tone="destructive"
                        secondaryActionText="Cancel"
                        primaryActionText="Forget"
                        onConfirm={handleClearStoredReferral}
                    />
                </Alert>
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
