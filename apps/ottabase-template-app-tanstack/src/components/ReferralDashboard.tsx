/**
 * ReferralDashboard Component
 *
 * Displays referral stats, referral link, and allows users to manage their referral username.
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getStoredReferralCode, getReferralExpiryInfo, clearStoredReferralCode } from "@/lib/referrals";
import { validateReferralUsername } from "@ottabase/referrals";

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

  // Stored referral info (if user arrived via referral)
  const storedCode = getStoredReferralCode();
  const expiryInfo = getReferralExpiryInfo();

  useEffect(() => {
    loadData();
  }, [userId]);

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

  const handleUpdateUsername = async () => {
    // Validate
    const validation = validateReferralUsername(newUsername);
    if (!validation.valid) {
      setUsernameError(validation.error || "Invalid username");
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
      alert("Username updated successfully!");
    } catch (err) {
      setUsernameError(err instanceof Error ? err.message : "Failed to update username");
    } finally {
      setUpdating(false);
    }
  };

  const handleCopyLink = () => {
    if (!data?.user.referralUsername) return;

    const link = `${window.location.origin}?ref=${data.user.referralUsername}`;
    navigator.clipboard.writeText(link);
    alert("Referral link copied to clipboard!");
  };

  const handleClearStoredReferral = () => {
    if (confirm("Are you sure you want to clear the stored referral code?")) {
      clearStoredReferralCode();
      window.location.reload();
    }
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
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Clicks</div>
          <div className="text-3xl font-bold">{data.stats.total}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 dark:text-gray-400">Conversions</div>
          <div className="text-3xl font-bold text-green-600">{data.stats.completed}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
          <div className="text-3xl font-bold text-yellow-600">{data.stats.pending}</div>
        </div>
      </div>

      {/* Username Management */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Your Referral Username</h2>
        <div className="space-y-4">
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
              <button
                onClick={handleUpdateUsername}
                disabled={updating || !newUsername}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {updating ? "Updating..." : "Update"}
              </button>
            </div>
            {usernameError && (
              <div className="text-sm text-red-600 mt-1">{usernameError}</div>
            )}
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
        </div>
      </div>

      {/* Referral Link */}
      {referralLink && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Your Referral Link</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="flex-1 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Stored Referral Info (if user arrived via referral) */}
      {storedCode && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">You Were Referred!</h2>
          <div className="space-y-2">
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
            <button
              onClick={handleClearStoredReferral}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
            >
              Clear Stored Referral
            </button>
          </div>
        </div>
      )}

      {/* Recent Tracking */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        {data.tracking.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No activity yet</p>
        ) : (
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
                {data.tracking.slice(0, 10).map((track: any) => (
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
        )}
      </div>
    </div>
  );
}
