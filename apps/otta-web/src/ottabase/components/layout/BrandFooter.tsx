import { APP_META } from '@/ottabase/config';
import { useSession } from '@/lib/auth';
import { useBrand } from '@ottabase/brand-engine-react';
import type { ResolvedMenuSlotData } from '@ottabase/ottamenu/render';
import { MenuSlotRenderer } from '@ottabase/ottamenu/render';
import { Link, useLocation } from '@tanstack/react-router';
import { memo } from 'react';
import { BLOG_SITE } from '@/pages/blog/site';

export const BrandFooter = memo(function BrandFooter({ containerClass }: { containerClass: string }) {
    const { isAuthenticated } = useSession();
    const location = useLocation();
    const { config } = useBrand();
    const year = new Date().getFullYear();

    const defaultFooter = (
        <div className={`mx-auto flex flex-wrap items-baseline justify-between gap-3 px-4 py-10 ${containerClass}`}>
            <p className="text-[0.8125rem] text-muted-foreground">
                © {year} {APP_META.author || APP_META.appName}
            </p>
            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem] text-muted-foreground" aria-label="Footer">
                <Link to="/about" className="hover:text-foreground">
                    About
                </Link>
                <a href={BLOG_SITE.rssPath} className="hover:text-foreground">
                    RSS
                </a>
            </nav>
        </div>
    );

    const footerNav = config?.menuSlots ? (
        <MenuSlotRenderer
            slot="footer-nav"
            menuSlots={config.menuSlots as Record<string, ResolvedMenuSlotData[]> | undefined}
            options={{ isAuthenticated: !!isAuthenticated, pathname: location.pathname }}
            fallback={defaultFooter}
            className={`mx-auto px-4 py-10 ${containerClass}`}
        />
    ) : (
        defaultFooter
    );

    return <footer className="mt-auto">{footerNav}</footer>;
});
