/**
 * ReferralDashboard Component
 *
 * Displays referral stats, referral link, and allows users to manage their referral username.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getStoredReferralCode, getReferralExpiryInfo, clearStoredReferralCode } from "@/lib/referrals";
import { validateReferralUsername } from "@ottabase/referrals";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@ottabase/ui-shadcn";

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
  tracking: any[];
}

interface TrackingPaginationData {
  data: any[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

interface ReferralDashboardProps {
  userId: string;
}

export function ReferralDashboard({ userId }: ReferralDashboardProps) {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Pagination for tracking records
  const [trackingPage, setTrackingPage] = useState(1);
  const [trackingPerPage] = useState(10);
  const [trackingData, setTrackingData] = useState<TrackingPaginationData | null>(null);
  const [loadingTracking, setLoadingTracking] = useState(false);

  // Stored referral info (if user arrived via referral)
  const storedCode = getStoredReferralCode();
  const expiryInfo = getReferralExpiryInfo();

  useEffect(() => {
    loadData();
  }, [userId]);

  useEffect(() => {
    loadTrackingData();
  }, [userId, trackingPage]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api(`/api/referrals/user?userId=${userId}`);

      if (!response.ok) {
        throw new Error("Failed to load referral data");
      }

      const data = await response.json();
      setData(data);
      setNewUsername(data.user.referralUsername || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadTrackingData = async () => {
    try {
      setLoadingTracking(true);
      const response = await api(
        `/api/referrals/tracking?userId=${userId}&page=${trackingPage}&perPage=${trackingPerPage}`
      );

      if (!response.ok) {
        throw new Error("Failed to load tracking data");
      }

      const data = await response.json();
      setTrackingData(data);
    } catch (err) {
      console.error("Error loading tracking data:", err);
      toast.error("Failed to load activity data");
    } finally {
      setLoadingTracking(false);
    }
  };

  const handleUpdateUsername = async () => {
    // Validate
    const validation = validateReferralUsername(newUsername);
    if (!validation.valid) {
      setUsernameError(validation.error || "Invalid username");
      toast.error(validation.error || "Invalid username");
      return;
    }

    setUsernameError(null);
    setUpdating(true);

    try {
      const response = await api("/api/referrals/username", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          referralUsername: newUsername,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update username");
      }

      // Reload data
      await loadData();
      toast.success("Username updated successfully!");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update username";
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
    toast.success("Referral link copied to clipboard!");
  };

  const handleClearStoredReferral = () => {
    clearStoredReferralCode();
    toast.success("Stored referral code cleared");
    window.location.reload();
  };

  if (loading) {
    return <div className="p-4">Loading referral data...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  if (!data) {
    return <div className="p-4">No data available</div>;
  }

  const referralLink = data.user.referralUsername
    ? `${window.location.origin}?ref=${data.user.referralUsername}`
    : null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Referral Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Clicks</div>
            <div className="text-3xl font-bold">{data.stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Conversions</div>
            <div className="text-3xl font-bold text-green-600">{data.stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Pending</div>
            <div className="text-3xl font-bold text-yellow-600">{data.stats.pending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Username Management */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referral Username</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Referral Username
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g., johndoe"
                className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
              <Button
                onClick={handleUpdateUsername}
                disabled={updating || !newUsername}
              >
                {updating ? "Updating..." : "Update"}
              </Button>
            </div>
            {usernameError && (
              <div className="text-sm text-red-600 mt-1">{usernameError}</div>
            )}
            <div className="text-sm text-muted-foreground mt-1">
              3-20 characters, letters/numbers/underscore only
            </div>
          </div>

          {data.user.referralUsername && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> Changing your username will invalidate your old
                referral links and may affect pending conversions.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral Link */}
      {referralLink && (
        <Card>
          <CardHeader>
            <CardTitle>Your Referral Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <input
                type="text"
                value={referralLink}
                readOnly
                className="flex-1 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
              />
              <Button onClick={handleCopyLink} variant="default">
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stored Referral Info (if user arrived via referral) */}
      {storedCode && (
        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <CardHeader>
            <CardTitle>You Were Referred!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <strong>Referral Code:</strong> {storedCode}
            </p>
            <p>
              <strong>Expires:</strong>{" "}
              {expiryInfo.expiresAt?.toLocaleDateString() || "N/A"}
            </p>
            <p>
              <strong>Days Remaining:</strong> {expiryInfo.daysRemaining || 0}
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="mt-2">
                  Clear Stored Referral
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Stored Referral?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the stored referral code from your browser.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearStoredReferral}>
                    Clear
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* Recent Tracking with Pagination */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTracking ? (
            <p className="text-muted-foreground">Loading activity...</p>
          ) : !trackingData || trackingData.data.length === 0 ? (
            <p className="text-muted-foreground">No activity yet</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">IP Address</th>
                      <th className="text-left py-2">Created</th>
                      <th className="text-left py-2">Converted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackingData.data.map((track: any) => (
                      <tr key={track.id} className="border-b dark:border-gray-700">
                        <td className="py-2">
                          <span
                            className={`px-2 py-1 rounded text-sm ${
                              track.status === "completed"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            }`}
                          >
                            {track.status}
                          </span>
                        </td>
                        <td className="py-2 text-sm">{track.ipAddress}</td>
                        <td className="py-2 text-sm">
                          {new Date(track.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 text-sm">
                          {track.conversionAt
                            ? new Date(track.conversionAt).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {trackingData.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {trackingData.page} of {trackingData.totalPages} (
                    {trackingData.total} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTrackingPage((p) => Math.max(1, p - 1))}
                      disabled={trackingPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTrackingPage((p) => Math.min(trackingData.totalPages, p + 1))}
                      disabled={trackingPage === trackingData.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
