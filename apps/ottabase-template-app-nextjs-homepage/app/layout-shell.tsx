'use client';

import { ConfigPanel } from '../components/ConfigPanel';
import { SlotRenderer } from '../components/SlotRenderer';

const GITHUB_URL = 'https://github.com/thinkdj/ottabase';

const NAVBAR_DATA = {
    title: 'Ottabase',
    githubUrl: GITHUB_URL,
};

const FOOTER_DATA = {
    siteName: 'Ottabase',
    tagline: 'Built with Next.js & Cloudflare Workers',
    links: [
        { href: '/about', label: 'About' },
        { href: '/theme-demo', label: 'Themes' },
        { href: '/homepage-config', label: 'Config' },
        { href: GITHUB_URL, label: 'GitHub', external: true },
    ],
};

export function LayoutShell({ children }: { children: React.ReactNode }) {
    return (
        <>
            <SlotRenderer slot="navbar" data={NAVBAR_DATA} />
            <main className="flex-1">{children}</main>
            <SlotRenderer slot="footer" data={FOOTER_DATA} />
            <ConfigPanel />
        </>
    );
}
