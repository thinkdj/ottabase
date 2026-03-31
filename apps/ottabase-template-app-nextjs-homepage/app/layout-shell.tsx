'use client';

import type { FooterData } from '../components/variants/footer/types';
import type { NavbarData } from '../components/variants/navbar/types';
import { ConfigPanel } from '../components/ConfigPanel';
import { SlotRenderer } from '../components/SlotRenderer';
import { FALLBACK_FOOTER_DATA, FALLBACK_NAVBAR_DATA } from '../lib/homepage-map';

export function LayoutShell({
    children,
    navbarData = FALLBACK_NAVBAR_DATA,
    footerData = FALLBACK_FOOTER_DATA,
}: {
    children: React.ReactNode;
    navbarData?: NavbarData;
    footerData?: FooterData;
}) {
    return (
        <>
            <SlotRenderer slot="navbar" data={navbarData} />
            <main className="flex-1">{children}</main>
            <SlotRenderer slot="footer" data={footerData} />
            <ConfigPanel />
        </>
    );
}
