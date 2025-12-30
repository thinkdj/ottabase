import React from "react";
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

// Pass a space " " for no appName (logo only)
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
  const minWidthClass = minWidthPx === 279 ? "min-w-[279px]" : "min-w-[100px]";

  const appLogoUrl = logoUrl || config.meta.logoUrl; // relative path `/logo.png` would be in `public` folder during dev;
  const appNameTitle = appName || config.meta.appName;

  const renderDarkModeToggle = () =>
    darkModeSwitcher && <DarkModeToggle type="button" />;

  const LogoContent = () => (
    <>
      {appLogoUrl && (
        <img
          src={appLogoUrl}
          alt={`${appNameTitle}`}
          height={size}
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
      className={`flex flex-row flex-nowrap items-center justify-between gap-4 ${minWidthClass}`}
    >
      <div className="flex items-center gap-3 p-2">
        {linkUrl ? (
          <a
            href={linkUrl}
            className="flex items-center gap-3"
            aria-label={appNameTitle || "Home"}
            title={appNameTitle || "Home"}
          >
            <LogoContent />
          </a>
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
