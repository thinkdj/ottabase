// ---------------------------------------------------------------------------
// ConfigurableLayout – Renders layout structure from LayoutConfig
// Used by LayoutResolver when BrandProvider supplies routeMappings + layoutTemplatesMap
// ---------------------------------------------------------------------------

import { ReferralTracker } from '@/components/ReferralTracker';
import { useMemo } from 'react';
import { BrandFooter } from './layout/BrandFooter';
import { MinimalHeader, TopbarHeader } from './layout/BrandHeaders';
import { DrawerNav } from './layout/DrawerNav';
import { SidebarNav } from './layout/SidebarNav';
import { contentWidthClass, densityPadding } from './layout/layout.utils';
import type { LayoutConfig } from '@ottabase/brand-engine';

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
    const cw = config?.contentWidth ?? 'fixed';
    const showFooter = config?.footer ?? true;
    const density = config?.density ?? 'comfy';

    const cwClass = contentWidthClass(cw);
    const paddingClass = densityPadding(density);

    const hasSidebar = navigation === 'sidebar';
    const hasDrawer = navigation === 'drawer';
    const navInHeader = navigation === 'topbar';

    const drawerTrigger = useMemo(() => (hasDrawer ? <DrawerNav /> : undefined), [hasDrawer]);

    return (
        <div className="min-h-screen bg-background font-sans flex flex-col">
            <ReferralTracker />

            {header === 'topbar' && (
                <TopbarHeader showNav={navInHeader} containerClass={cwClass} leading={drawerTrigger} />
            )}
            {header === 'sidebar' && <TopbarHeader showNav={false} containerClass={cwClass} leading={drawerTrigger} />}
            {header === 'minimal' && <MinimalHeader containerClass={cwClass} leading={drawerTrigger} />}
            {header === 'none' && hasDrawer && (
                <div className="fixed top-4 left-4 z-40">
                    <DrawerNav />
                </div>
            )}

            <div className="flex flex-col md:flex-row flex-1">
                {hasSidebar && <SidebarNav />}

                <main
                    className={`flex-1 min-w-0 mx-auto px-4 ${paddingClass} ${hasSidebar ? 'max-w-none w-full' : cwClass}`}
                >
                    {children}
                </main>
            </div>

            {showFooter && <BrandFooter containerClass={cwClass} />}
        </div>
    );
}
