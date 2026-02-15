// ---------------------------------------------------------------------------
// ConfigurableLayout – Renders layout structure from LayoutConfig
// Uses expanded config fields + layout slots from @ottabase/ottalayout
// ---------------------------------------------------------------------------

import { ReferralTracker } from '@/components/ReferralTracker';
import type { LayoutConfig } from '@ottabase/ottalayout';
import { contentWidthClass, containerPaddingClass, densityPadding, sidebarWidthClass } from '@ottabase/ottalayout';
import { LayoutSlot } from '@ottabase/ottalayout/react';
import { useMemo } from 'react';
import { BrandFooter } from './layout/BrandFooter';
import { MinimalHeader, TopbarHeader } from './layout/BrandHeaders';
import { DrawerNav } from './layout/DrawerNav';
import { SidebarNav } from './layout/SidebarNav';

export interface ConfigurableLayoutProps {
    config: LayoutConfig;
    children: React.ReactNode;
}

/**
 * Renders the app shell from LayoutConfig.
 * Used by @ottabase/brand-engine-react LayoutResolver.
 */
export function ConfigurableLayout({ config, children }: ConfigurableLayoutProps) {
    const header = config?.header ?? 'topbar';
    const navigation = config?.navigation ?? 'topbar';
    const cw = config?.contentWidth ?? 'lg';
    const showFooter = config?.footer ?? true;
    const density = config?.density ?? 'comfy';
    const sticky = config?.headerSticky ?? header === 'topbar';
    const center = config?.centerContent ?? false;
    const cPadding = config?.containerPadding ?? 'md';

    const cwClass = contentWidthClass(cw);
    const paddingClass = densityPadding(density);
    const cPaddingClass = containerPaddingClass(cPadding);

    const hasSidebar = navigation === 'sidebar';
    const hasDrawer = navigation === 'drawer';
    const navInHeader = navigation === 'topbar';
    const noNav = navigation === 'none';

    const drawerTrigger = useMemo(() => (hasDrawer ? <DrawerNav /> : undefined), [hasDrawer]);

    return (
        <div className="min-h-screen bg-background font-sans flex flex-col">
            <ReferralTracker />

            {/* Announcement slot – pages can inject banners here */}
            <LayoutSlot name="announcement" />

            {header === 'topbar' && (
                <TopbarHeader showNav={navInHeader} containerClass={cwClass} leading={drawerTrigger} sticky={sticky} />
            )}
            {header === 'sidebar' && (
                <TopbarHeader showNav={false} containerClass={cwClass} leading={drawerTrigger} sticky={sticky} />
            )}
            {header === 'minimal' && <MinimalHeader containerClass={cwClass} leading={drawerTrigger} />}
            {header === 'none' && hasDrawer && (
                <div className="fixed top-4 left-4 z-40">
                    <DrawerNav />
                </div>
            )}

            <div className="flex flex-col md:flex-row flex-1">
                {hasSidebar && <SidebarNav widthClass={sidebarWidthClass(config?.sidebarWidth)} />}

                <main
                    className={`flex-1 min-w-0 mx-auto ${cPaddingClass} ${paddingClass} ${hasSidebar ? 'max-w-none w-full' : cwClass}`}
                >
                    {/* Toolbar + breadcrumbs slots – pages can inject toolbars here */}
                    <LayoutSlot name="breadcrumbs" />
                    <LayoutSlot name="toolbar" />

                    {center ? (
                        <div className="flex flex-1 items-center justify-center min-h-[60vh]">{children}</div>
                    ) : (
                        children
                    )}
                </main>

                {/* Right sidebar slot – pages can inject panels here */}
                <LayoutSlot name="sidebar-right" />
            </div>

            {showFooter && <BrandFooter containerClass={cwClass} />}
        </div>
    );
}
