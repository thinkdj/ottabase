import { createAppConfig } from '@ottabase/config';
import { DarkModeToggle } from '@ottabase/ui';

interface LogoProps {
    size?: number;
    darkModeSwitcher?: boolean;
    logoUrl?: string;
    appName?: string;
    linkUrl?: string;
    /** Optional app config; a default one is created when omitted */
    appConfig?: ReturnType<typeof createAppConfig>;
}

/**
 * The app's logo image and name from config, with an optional theme switch beside it.
 * Pass a space (" ") as `appName` to show the logo only.
 */
export function Logo({ size = 32, darkModeSwitcher = false, logoUrl, appName, linkUrl = '', appConfig }: LogoProps) {
    const config = appConfig || createAppConfig();

    const minWidthClass = appName && appName.length > 10 ? 'min-w-[279px]' : 'min-w-[100px]';

    // A relative path such as `/logo.png` is served from `public/`
    const appLogoUrl = logoUrl || config.meta.logoUrl;
    const appNameTitle = appName || config.meta.appName;

    const content = (
        <>
            {appLogoUrl && <img src={appLogoUrl} alt={appNameTitle} height={size} className="rounded object-contain" />}
            {appNameTitle && <h4 className="text-lg font-semibold">{appNameTitle}</h4>}
        </>
    );

    return (
        <div className={`flex flex-row flex-nowrap items-center justify-between gap-4 ${minWidthClass}`}>
            <div className="flex items-center gap-3 p-2">
                {linkUrl ? (
                    <a
                        href={linkUrl}
                        className="flex items-center gap-3"
                        aria-label={appNameTitle || 'Home'}
                        title={appNameTitle || 'Home'}
                    >
                        {content}
                    </a>
                ) : (
                    <div className="flex items-center gap-3">{content}</div>
                )}
            </div>
            {darkModeSwitcher && <DarkModeToggle type="button" />}
        </div>
    );
}
