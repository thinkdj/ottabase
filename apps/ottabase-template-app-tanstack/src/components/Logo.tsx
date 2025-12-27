import React from "react";
import { Link } from "@tanstack/react-router";
import DarkModeToggle from "./DarkModeToggle";
import { createAppConfig } from "@ottabase/config";

interface LogoProps {
  size?: number;
  darkModeSwitcher?: boolean;
  logoUrl?: string;
  appName?: string;
  linkUrl?: string;
  /** Optional app config - if not provided, will create default config */
  appConfig?: ReturnType<typeof createAppConfig>;
}

const defaultSizePx = 32;

/**
 * Logo - TanStack-compatible logo component
 * 
 * Uses TanStack Router's Link component instead of next/link.
 */
export function Logo({
  size = defaultSizePx,
  darkModeSwitcher = false,
  logoUrl,
  appName,
  linkUrl = "",
  appConfig,
}: LogoProps) {
  // Create default config if none provided
  const config = appConfig || createAppConfig();

  const minWidthPx = appName && appName?.length > 10 ? 279 : 100;

  const appLogoUrl = logoUrl || config.meta.logoUrl;
  const appNameTitle = appName || config.meta.appName;

  const renderDarkModeToggle = () =>
    darkModeSwitcher && <DarkModeToggle type="button" />;

  const LogoContent = () => (
    <>
      {appLogoUrl && (
        <img
          src={appLogoUrl}
          alt={`${appNameTitle}`}
          style={{ height: `${size}px`, width: "auto" }}
          className="rounded object-contain"
        />
      )}
      {appNameTitle && (
        <h4 className="text-lg font-semibold">{appNameTitle}</h4>
      )}
    </>
  );

  return (
    <div
      className="flex flex-row flex-nowrap items-center justify-between gap-4"
      style={{ minWidth: `${minWidthPx}px` }}
    >
      <div className="flex items-center gap-3 p-2">
        {linkUrl ? (
          <Link to={linkUrl} className="flex items-center gap-3">
            <LogoContent />
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <LogoContent />
          </div>
        )}
      </div>
      {renderDarkModeToggle()}
    </div>
  );
}

export default Logo;
