import type { ReactNode } from 'react';
import { SiteFooter } from './SiteFooter';
import type { NavActive } from './SiteNav';
import { SiteNav } from './SiteNav';

type Props = {
    children: ReactNode;
    navActive?: NavActive;
};

export function MarketingLayout({ children, navActive }: Props) {
    return (
        <>
            <SiteNav active={navActive} />
            {children}
            <SiteFooter />
        </>
    );
}
