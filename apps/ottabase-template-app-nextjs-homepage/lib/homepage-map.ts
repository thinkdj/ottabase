import type { FooterData } from '../components/variants/footer/types';
import type { NavbarData } from '../components/variants/navbar/types';

const GITHUB_URL = 'https://github.com/thinkdj/ottabase';

/** Used when layout cannot load API (SSR fallback only). Prefer `payload.slots` from getHomepageData(). */
export const FALLBACK_NAVBAR_DATA: NavbarData = {
    title: 'Ottabase',
    githubUrl: GITHUB_URL,
    links: [
        { href: '/', label: 'Home' },
        { href: '/about', label: 'About' },
        { href: '/theme-demo', label: 'Themes' },
    ],
};

/** Used when layout cannot load API (SSR fallback only). */
export const FALLBACK_FOOTER_DATA: FooterData = {
    siteName: 'Ottabase',
    tagline: 'Built with Next.js & Cloudflare Workers',
    links: [
        { href: '/about', label: 'About' },
        { href: '/theme-demo', label: 'Themes' },
        { href: '/homepage-config', label: 'Config' },
        { href: GITHUB_URL, label: 'GitHub', external: true },
    ],
};
