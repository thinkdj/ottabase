"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import type {
  ReferralProviderConfig,
  ReferralData,
  ReferralContextValue,
} from "./types";

const ReferralContext = createContext<ReferralContextValue | null>(null);

const DEFAULT_CONFIG: Required<Omit<ReferralProviderConfig, "onReferralDetected" | "onReferralCleared">> = {
  storageKey: "ottabase.referral",
  queryParam: "referrer",
  overrideReferral: true,
  expiryMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  appName: "default",
  debug: false,
};

interface ReferralProviderProps {
  children: React.ReactNode;
  config?: ReferralProviderConfig;
}

/**
 * ReferralProvider component
 * 
 * Wraps your application to automatically detect and persist referral codes
 * from URL query parameters to localStorage.
 * 
 * @example
 * ```tsx
 * <ReferralProvider config={{ overrideReferral: false, expiryMs: 7 * 24 * 60 * 60 * 1000 }}>
 *   <App />
 * </ReferralProvider>
 * ```
 */
export function ReferralProvider({
  children,
  config = {},
}: ReferralProviderProps) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [isClient, setIsClient] = useState(false);

  const log = useCallback(
    (...args: unknown[]) => {
      if (mergedConfig.debug) {
        console.log("[ReferralProvider]", ...args);
      }
    },
    [mergedConfig.debug]
  );

  // Load referral from localStorage
  const loadReferral = useCallback((): ReferralData | null => {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(mergedConfig.storageKey);
      if (!stored) return null;

      const data = JSON.parse(stored) as ReferralData;

      // Check if expired
      if (data.expiresAt && Date.now() > data.expiresAt) {
        log("Referral expired, clearing");
        localStorage.removeItem(mergedConfig.storageKey);
        config.onReferralCleared?.();
        return null;
      }

      log("Loaded referral:", data.referrerCode);
      return data;
    } catch (error) {
      log("Error loading referral:", error);
      return null;
    }
  }, [mergedConfig.storageKey, log, config]);

  // Save referral to localStorage
  const saveReferral = useCallback(
    (data: ReferralData) => {
      if (typeof window === "undefined") return;

      try {
        localStorage.setItem(mergedConfig.storageKey, JSON.stringify(data));
        log("Saved referral:", data.referrerCode);
      } catch (error) {
        log("Error saving referral:", error);
      }
    },
    [mergedConfig.storageKey, log]
  );

  // Clear referral from localStorage
  const clearReferralStorage = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem(mergedConfig.storageKey);
      log("Cleared referral");
      config.onReferralCleared?.();
    } catch (error) {
      log("Error clearing referral:", error);
    }
  }, [mergedConfig.storageKey, log, config]);

  // Manually set a referral code
  const setReferral = useCallback(
    (code: string, metadata?: Record<string, unknown>) => {
      const now = Date.now();
      const expiresAt = mergedConfig.expiryMs
        ? now + mergedConfig.expiryMs
        : null;

      const newData: ReferralData = {
        referrerCode: code,
        capturedAt: now,
        expiresAt,
        sourceUrl: typeof window !== "undefined" ? window.location.href : undefined,
        metadata,
      };

      setReferralData(newData);
      saveReferral(newData);
      config.onReferralDetected?.(code);
    },
    [mergedConfig.expiryMs, saveReferral, config]
  );

  // Clear referral
  const clearReferral = useCallback(() => {
    setReferralData(null);
    clearReferralStorage();
  }, [clearReferralStorage]);

  // Check if expired
  const isExpired = useCallback(() => {
    if (!referralData?.expiresAt) return false;
    return Date.now() > referralData.expiresAt;
  }, [referralData]);

  // Get time remaining
  const getTimeRemaining = useCallback(() => {
    if (!referralData?.expiresAt) return null;
    const remaining = referralData.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }, [referralData]);

  // Initialize on mount (client-side only)
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load referral on mount and check URL parameters
  useEffect(() => {
    if (!isClient) return;

    // Load existing referral from localStorage
    const existing = loadReferral();

    // Check URL for referral parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlReferrer = urlParams.get(mergedConfig.queryParam);

    if (urlReferrer) {
      // Decide whether to override existing referral
      if (!existing || mergedConfig.overrideReferral) {
        log("Detected referral from URL:", urlReferrer);
        setReferral(urlReferrer);
      } else {
        log("Referral in URL but not overriding existing:", existing.referrerCode);
        setReferralData(existing);
      }
    } else if (existing) {
      // No URL param, but we have existing referral
      setReferralData(existing);
    }
  }, [isClient, loadReferral, mergedConfig.queryParam, mergedConfig.overrideReferral, setReferral, log]);

  const contextValue = useMemo<ReferralContextValue>(
    () => ({
      referralData,
      referrerCode: referralData?.referrerCode || null,
      hasReferral: !!referralData,
      setReferral,
      clearReferral,
      isExpired,
      getTimeRemaining,
    }),
    [referralData, setReferral, clearReferral, isExpired, getTimeRemaining]
  );

  return (
    <ReferralContext.Provider value={contextValue}>
      {children}
    </ReferralContext.Provider>
  );
}

/**
 * Hook to access referral context
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { referrerCode, hasReferral, clearReferral } = useReferral();
 *   
 *   if (hasReferral) {
 *     return <div>Referred by: {referrerCode}</div>;
 *   }
 *   return <div>No referral</div>;
 * }
 * ```
 */
export function useReferral(): ReferralContextValue {
  const context = useContext(ReferralContext);
  if (!context) {
    throw new Error("useReferral must be used within a ReferralProvider");
  }
  return context;
}
