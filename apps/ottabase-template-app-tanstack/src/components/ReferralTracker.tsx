/**
 * ReferralTracker Component
 *
 * Automatically tracks referral links when the ?ref parameter is present in the URL.
 * Place this component at the root of your app to enable referral tracking.
 */

import { useEffect, useRef } from "react";
import {
  getStoredReferralCode,
  storeReferralCode,
  trackReferralClick,
  cleanReferralFromUrl,
} from "@/lib/referrals";

export function ReferralTracker() {
  const hasTracked = useRef(false);

  useEffect(() => {
    // Only run once
    if (hasTracked.current) return;
    hasTracked.current = true;

    // Check for ref parameter in URL
    const params = new URLSearchParams(window.location.search);
    const referralCode = params.get("ref");

    if (!referralCode) {
      // No referral code in URL
      return;
    }

    // Check if we already have a stored referral code
    const existingCode = getStoredReferralCode();

    if (existingCode) {
      console.log(
        "Already have a stored referral code (first-touch wins):",
        existingCode
      );
      // Still track the click, but don't overwrite the stored code
      trackReferralClick(referralCode).catch((error) => {
        console.error("Failed to track referral click:", error);
      });

      // Clean URL
      cleanReferralFromUrl();
      return;
    }

    // Store the referral code (first-touch)
    storeReferralCode(referralCode);

    // Track the click
    trackReferralClick(referralCode)
      .then((success) => {
        if (success) {
          console.log("Referral click tracked successfully");
        }
      })
      .catch((error) => {
        console.error("Failed to track referral click:", error);
      });

    // Clean URL (remove ref parameter)
    cleanReferralFromUrl();
  }, []);

  // This component renders nothing
  return null;
}
