import { useSession } from '@/lib/auth';
import { useBrand } from '@ottabase/brand-engine-react';
import type { ResolvedMenuSlotData } from '@ottabase/ottamenu/render';
import { MenuSlotRenderer } from '@ottabase/ottamenu/render';
import { useLocation } from '@tanstack/react-router';
import { memo } from 'react';

export const BrandFooter = memo(function BrandFooter({ containerClass }: { containerClass: string }) {
    const { isAuthenticated } = useSession();
    const location = useLocation();
    const { config } = useBrand();

    const defaultFooter = (
        <div
            className={`mx-auto px-4 py-6 text-center text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ${containerClass}`}
        >
            Built with Ottabase
        </div>
    );

    const footerNav = config?.menuSlots ? (
        <MenuSlotRenderer
            slot="footer-nav"
            menuSlots={config.menuSlots as Record<string, ResolvedMenuSlotData[]> | undefined}
            options={{ isAuthenticated: !!isAuthenticated, pathname: location.pathname }}
            fallback={defaultFooter}
            className={`mx-auto px-4 py-6 ${containerClass}`}
        />
    ) : (
        defaultFooter
    );

    return <footer className="mt-auto border-t border-border/60">{footerNav}</footer>;
});
