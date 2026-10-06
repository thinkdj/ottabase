/** Navigation menus for the site, and the slots they fill when nothing is assigned yet. */
export interface DemoMenu {
    slug: string;
    name: string;
    type: 'navbar' | 'footer';
    slot: 'header-nav' | 'footer-nav';
    items: readonly { name: string; link: string; newTab?: boolean }[];
}

export const MENUS: readonly DemoMenu[] = [
    {
        slug: 'main-navigation',
        name: 'Main navigation',
        type: 'navbar',
        slot: 'header-nav',
        items: [
            { name: 'Home', link: '/' },
            { name: 'Blog', link: '/blog' },
            { name: "What's new", link: '/changelog' },
            { name: 'Docs', link: '/docs' },
            { name: 'Demos', link: '/demo' },
        ],
    },
    {
        slug: 'footer',
        name: 'Footer',
        type: 'footer',
        slot: 'footer-nav',
        items: [
            { name: 'Blog', link: '/blog' },
            { name: 'Release notes', link: '/changelog' },
            { name: 'Docs', link: '/docs' },
            { name: 'GitHub', link: 'https://github.com/thinkdj/ottabase', newTab: true },
        ],
    },
];
