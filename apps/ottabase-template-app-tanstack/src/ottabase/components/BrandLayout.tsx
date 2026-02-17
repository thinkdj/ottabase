import { ReferralTracker } from '@/components/ReferralTracker';
import { useTheme } from '@/ottabase/providers/ThemeContext';
import { contentWidthClass, densityPadding } from '@ottabase/ottalayout';
import { Outlet } from '@tanstack/react-router';
import { useMemo } from 'react';
import { BrandFooter } from './layout/BrandFooter';
import { MinimalHeader, TopbarHeader } from './layout/BrandHeaders';
import { DrawerNav } from './layout/DrawerNav';
import { SidebarNav } from './layout/SidebarNav';

// ---------------------------------------------------------------------------
// BrandLayout – the root layout component driven by BrandEngine config
// ---------------------------------------------------------------------------

export function BrandLayout() {
    const { layout } = useTheme();

    const header = layout?.header ?? 'topbar';
    const navigation = layout?.navigation ?? 'topbar';
    const cw = layout?.contentWidth ?? 'fixed';
    const showFooter = layout?.footer ?? true;
    const density = layout?.density ?? 'comfy';

    const cwClass = contentWidthClass(cw);
    const paddingClass = densityPadding(density);

    const hasSidebar = navigation === 'sidebar';
    const hasDrawer = navigation === 'drawer';
    const navInHeader = navigation === 'topbar';

    // Drawer trigger shown in header for drawer navigation mode
    // Memoized to maintain referential equality when passed to memoized headers
    const drawerTrigger = useMemo(() => (hasDrawer ? <DrawerNav /> : undefined), [hasDrawer]);

    return (
        <div className="min-h-screen bg-background font-sans flex flex-col">
            <ReferralTracker />

            {/* Header */}
            {header === 'topbar' && (
                <TopbarHeader showNav={navInHeader} containerClass={cwClass} leading={drawerTrigger} />
            )}
            {header === 'sidebar' && <TopbarHeader showNav={false} containerClass={cwClass} leading={drawerTrigger} />}
            {header === 'minimal' && <MinimalHeader containerClass={cwClass} leading={drawerTrigger} />}
            {/* header === 'none' renders nothing above the content */}
            {header === 'none' && hasDrawer && (
                <div className="fixed top-4 left-4 z-40">
                    <DrawerNav />
                </div>
            )}

            {/* Body: optional sidebar + content */}
            <div className="flex flex-col md:flex-row flex-1">
                {hasSidebar && <SidebarNav />}

                <main
                    className={`flex-1 min-w-0 mx-auto px-4 ${paddingClass} ${hasSidebar ? 'max-w-none w-full' : cwClass}`}
                >
                    <Outlet />
                </main>
            </div>

            {/* Footer */}
            {showFooter && <BrandFooter containerClass={cwClass} />}
        </div>
    );
}
