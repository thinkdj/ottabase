/**
 * Server-side Referral Attribution Helper
 *
 * This helper should be called during user creation to handle referral attribution.
 * Typically used in Auth.js callbacks or custom registration endpoints.
 */

import { User } from "@ottabase/ottaorm/models";
import { ReferralTracking } from "../models/ReferralTracking";
import type { KVNamespace } from "@cloudflare/workers-types";
import { createKVClient } from "@ottabase/cf/kv";

export interface ReferralAttributionOptions {
  newUserId: string;
  sessionId?: string;
  referralCode?: string;
  kvNamespace?: KVNamespace;
}

export interface ReferralAttributionResult {
  attributed: boolean;
  referrerId?: string;
  referralCode?: string;
  trackingRecordsUpdated: number;
  error?: string;
}

/**
 * Process referral attribution for a newly created user
 *
 * This function:
 * 1. Gets the pending referral code from KV (if sessionId provided)
 * 2. Looks up the referrer by referralUsername
 * 3. Sets the new user's referredById field
 * 4. Updates ReferralTracking records from pending to completed
 * 5. Clears the pending referral from KV
 *
 * @param options - Attribution options
 * @returns Attribution result
 */
export async function processReferralAttribution(
  options: ReferralAttributionOptions
): Promise<ReferralAttributionResult> {
  const { newUserId, sessionId, referralCode: providedCode, kvNamespace } = options;

  let referralCode = providedCode;

  try {
    // 1. Get pending referral code from KV if not provided
    if (!referralCode && sessionId && kvNamespace) {
      const kv = createKVClient({ namespace: kvNamespace as any });
      const key = `pending_referral:${sessionId}`;
      const result = await kv.getText(key);

      if (result.success && result.data) {
        referralCode = result.data;
      }
    }

    // If no referral code found, nothing to attribute
    if (!referralCode) {
      return {
        attributed: false,
        trackingRecordsUpdated: 0,
      };
    }

    // 2. Look up the referrer by referralUsername
    const referrer = await User.findByReferralUsername(referralCode);

    if (!referrer) {
      console.warn(`Referrer not found for code: ${referralCode}`);
      return {
        attributed: false,
        trackingRecordsUpdated: 0,
        error: "Referrer not found",
      };
    }

    const referrerId = referrer.get("id");

    // Prevent self-referral
    if (referrerId === newUserId) {
      console.warn("Attempted self-referral");
      return {
        attributed: false,
        trackingRecordsUpdated: 0,
        error: "Self-referral not allowed",
      };
    }

    // 3. Set the new user's referredById field
    const newUser = await User.find(newUserId);
    if (newUser) {
      newUser.set("referredById", referrerId);
      await newUser.save();
    }

    // 4. Update ReferralTracking records from pending to completed
    const pendingRecords = await ReferralTracking.findPendingByCode(referralCode);

    let updatedCount = 0;
    for (const record of pendingRecords) {
      await record.markCompleted(newUserId);
      updatedCount++;
    }

    // 5. Clear the pending referral from KV
    if (sessionId && kvNamespace) {
      const kv = createKVClient({ namespace: kvNamespace as any });
      const key = `pending_referral:${sessionId}`;
      await kv.delete(key);
    }

    console.log(
      `Referral attribution successful: User ${newUserId} referred by ${referrerId} (${referralCode})`
    );

    return {
      attributed: true,
      referrerId,
      referralCode,
      trackingRecordsUpdated: updatedCount,
    };
  } catch (error) {
    console.error("Error processing referral attribution:", error);
    return {
      attributed: false,
      trackingRecordsUpdated: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get pending referral code for a session
 *
 * @param sessionId - Session ID
 * @param kvNamespace - KV namespace
 * @returns Referral code or null
 */
export async function getPendingReferralCode(
  sessionId: string,
  kvNamespace: KVNamespace
): Promise<string | null> {
  try {
    const kv = createKVClient({ namespace: kvNamespace as any });
    const key = `pending_referral:${sessionId}`;
    const result = await kv.getText(key);

    return result.success && result.data ? result.data : null;
  } catch (error) {
    console.error("Error getting pending referral code:", error);
    return null;
  }
}

/**
 * Clear pending referral code for a session
 *
 * @param sessionId - Session ID
 * @param kvNamespace - KV namespace
 */
export async function clearPendingReferralCode(
  sessionId: string,
  kvNamespace: KVNamespace
): Promise<void> {
  try {
    const kv = createKVClient({ namespace: kvNamespace as any });
    const key = `pending_referral:${sessionId}`;
    await kv.delete(key);
  } catch (error) {
    console.error("Error clearing pending referral code:", error);
  }
}
