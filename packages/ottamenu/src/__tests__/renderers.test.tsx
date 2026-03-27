// ---------------------------------------------------------------------------
// Ottamenu – Renderer component tests
// Tests rendering of all 6 menu types via MenuRenderer + individual renderers.
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MenuForRender, MenuRenderType } from '../render/types';
import type { MenuItemDto } from '../types';

// Mock @tanstack/react-router Link as a simple <a>
vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children, className, title }: any) => (
        <a href={to} className={className} title={title}>
            {children}
        </a>
    ),
}));

// Import after mocks
import { DropdownMenuRenderer } from '../render/DropdownMenuRenderer';
import { FlyoutMenuRenderer } from '../render/FlyoutMenuRenderer';
import { FooterMenuRenderer } from '../render/FooterMenuRenderer';
import { MenuRenderer } from '../render/index';
import { MegaMenuRenderer } from '../render/MegaMenuRenderer';
import { MenuItemLink } from '../render/MenuItemLink';
import type { ResolvedMenuSlotData } from '../render/MenuSlotRenderer';
import { MenuSlotRenderer } from '../render/MenuSlotRenderer';
import { NavbarMenuRenderer } from '../render/NavbarMenuRenderer';
import { SidebarMenuRenderer } from '../render/SidebarMenuRenderer';

// ── Test data ────────────────────────────────────────────────────────────
function makeItem(overrides: Partial<MenuItemDto> & { id: string; name: string }): MenuItemDto {
    return {
        menuId: 'menu-1',
        link: `/${overrides.name.toLowerCase().replace(/\s+/g, '-')}`,
        sortOrder: 0,
        ...overrides,
    };
}

/** Flat menu (no nesting) */
const flatItems: MenuItemDto[] = [
    makeItem({ id: '1', name: 'Home', link: '/' }),
    makeItem({ id: '2', name: 'About', link: '/about' }),
    makeItem({ id: '3', name: 'Contact', link: '/contact' }),
];

/** Nested menu: mega-menu style (3 levels) */
const megaItems: MenuItemDto[] = [
    // Top-level triggers
    makeItem({ id: 'platform', name: 'Platform', link: '#' }),
    makeItem({ id: 'pricing', name: 'Pricing', link: '/pricing' }),
    // Column headers under Platform
    makeItem({ id: 'products', name: 'Products', parentId: 'platform', link: '#' }),
    makeItem({ id: 'features', name: 'Features', parentId: 'platform', link: '#' }),
    // Items under Products
    makeItem({
        id: 'claude',
        name: 'Claude',
        parentId: 'products',
        link: '/claude',
        image: '/img/claude.png',
        description: 'AI assistant',
    }),
    makeItem({
        id: 'code',
        name: 'Claude Code',
        parentId: 'products',
        link: '/code',
    }),
    // Items under Features
    makeItem({
        id: 'chrome',
        name: 'Claude in Chrome',
        parentId: 'features',
        link: '/chrome',
        newTab: true,
    }),
];

/** Footer-style menu (2 levels) */
const footerItems: MenuItemDto[] = [
    makeItem({ id: 'company', name: 'Company', link: '#' }),
    makeItem({ id: 'about', name: 'About', parentId: 'company', link: '/about' }),
    makeItem({ id: 'careers', name: 'Careers', parentId: 'company', link: '/careers' }),
    makeItem({ id: 'product', name: 'Product', link: '#' }),
    makeItem({ id: 'docs', name: 'Docs', parentId: 'product', link: '/docs' }),
];

const flatMenu: MenuForRender = { items: flatItems };
const megaMenu: MenuForRender = { items: megaItems };

// ── MenuRenderer dispatch ────────────────────────────────────────────────
describe('MenuRenderer', () => {
    it('returns null when menu is null', () => {
        const { container } = render(<MenuRenderer menu={null} type="sidebar" />);
        expect(container.innerHTML).toBe('');
    });

    it('returns null when items array is empty', () => {
        const { container } = render(<MenuRenderer menu={{ items: [] }} type="sidebar" />);
        expect(container.innerHTML).toBe('');
    });

    it('filters authRequired items when not authenticated', () => {
        const menu: MenuForRender = {
            items: [
                makeItem({ id: '1', name: 'Public', link: '/' }),
                makeItem({ id: '2', name: 'Private', link: '/private', authRequired: true }),
            ],
        };
        render(<MenuRenderer menu={menu} type="sidebar" options={{ isAuthenticated: false }} />);
        expect(screen.getByText('Public')).toBeTruthy();
        expect(screen.queryByText('Private')).toBeNull();
    });

    it('shows authRequired items when authenticated', () => {
        const menu: MenuForRender = {
            items: [
                makeItem({ id: '1', name: 'Public', link: '/' }),
                makeItem({ id: '2', name: 'Private', link: '/private', authRequired: true }),
            ],
        };
        render(<MenuRenderer menu={menu} type="sidebar" options={{ isAuthenticated: true }} />);
        expect(screen.getByText('Public')).toBeTruthy();
        expect(screen.getByText('Private')).toBeTruthy();
    });

    it.each(['sidebar', 'flyout', 'mega', 'navbar', 'dropdown', 'footer'] as MenuRenderType[])(
        'renders without crashing for type="%s"',
        (type) => {
            const menu = type === 'footer' ? { items: footerItems } : flatMenu;
            const { container } = render(<MenuRenderer menu={menu} type={type} options={{ pathname: '/' }} />);
            expect(container.innerHTML).not.toBe('');
        },
    );
});

// ── Individual renderer tests ────────────────────────────────────────────
describe('SidebarMenuRenderer', () => {
    it('renders all top-level items', () => {
        render(<SidebarMenuRenderer items={flatItems} pathname="/" />);
        expect(screen.getByText('Home')).toBeTruthy();
        expect(screen.getByText('About')).toBeTruthy();
        expect(screen.getByText('Contact')).toBeTruthy();
    });

    it('renders as a <nav> element', () => {
        const { container } = render(<SidebarMenuRenderer items={flatItems} pathname="/" />);
        expect(container.querySelector('nav')).toBeTruthy();
    });
});

describe('FlyoutMenuRenderer', () => {
    it('renders all items inside a popover-styled div', () => {
        const { container } = render(<FlyoutMenuRenderer items={flatItems} pathname="/" />);
        expect(screen.getByText('Home')).toBeTruthy();
        expect(container.querySelector('.rounded-lg')).toBeTruthy();
    });
});

describe('MegaMenuRenderer', () => {
    it('renders top-level triggers as a horizontal nav', () => {
        const { container } = render(<MegaMenuRenderer items={megaItems} pathname="/" />);
        const nav = container.querySelector('nav');
        expect(nav).toBeTruthy();
        // Top-level items: Platform (has children → button), Pricing (leaf → link)
        expect(screen.getByText('Platform')).toBeTruthy();
        expect(screen.getByText('Pricing')).toBeTruthy();
    });

    it('renders leaf top-level items as direct links', () => {
        render(<MegaMenuRenderer items={megaItems} pathname="/" />);
        const pricingLink = screen.getByText('Pricing').closest('a');
        expect(pricingLink).toBeTruthy();
        expect(pricingLink?.getAttribute('href')).toBe('/pricing');
    });
});

describe('NavbarMenuRenderer', () => {
    it('renders top-level items horizontally', () => {
        const { container } = render(<NavbarMenuRenderer items={flatItems} pathname="/" />);
        const nav = container.querySelector('nav');
        expect(nav).toBeTruthy();
        expect(screen.getByText('Home')).toBeTruthy();
    });
});

describe('DropdownMenuRenderer', () => {
    it('renders all items with popover styling', () => {
        const { container } = render(<DropdownMenuRenderer items={flatItems} pathname="/" />);
        expect(container.querySelector('.rounded-lg')).toBeTruthy();
        expect(screen.getByText('Home')).toBeTruthy();
        expect(screen.getByText('About')).toBeTruthy();
    });

    it('renders item with image', () => {
        const items = [makeItem({ id: '1', name: 'Product', link: '/p', image: '/img.png' })];
        const { container } = render(<DropdownMenuRenderer items={items} pathname="/" />);
        const img = container.querySelector('img');
        expect(img).toBeTruthy();
        expect(img?.getAttribute('src')).toBe('/img.png');
    });

    it('renders item description', () => {
        const items = [makeItem({ id: '1', name: 'Product', link: '/p', description: 'A great product' })];
        render(<DropdownMenuRenderer items={items} pathname="/" />);
        expect(screen.getByText('A great product')).toBeTruthy();
    });
});

describe('FooterMenuRenderer', () => {
    it('renders top-level items only (no children)', () => {
        render(<FooterMenuRenderer items={footerItems} pathname="/" />);
        // Top-level items should render
        expect(screen.getByText('Company')).toBeTruthy();
        expect(screen.getByText('Product')).toBeTruthy();
        // Children should NOT render (footer is flat, single-level)
        expect(screen.queryByText('About')).toBeNull();
        expect(screen.queryByText('Careers')).toBeNull();
        expect(screen.queryByText('Docs')).toBeNull();
    });

    it('renders as a <nav> element', () => {
        const { container } = render(<FooterMenuRenderer items={footerItems} pathname="/" />);
        expect(container.querySelector('nav')).toBeTruthy();
    });
});

// ── MenuItemLink tests ───────────────────────────────────────────────────
describe('MenuItemLink', () => {
    it('does not apply active class to hash-only links (renders as span)', () => {
        const item = makeItem({ id: '1', name: 'Placeholder', link: '#' });
        const { container } = render(<MenuItemLink item={item} pathname="#" />);
        // Placeholder links render as span to avoid Link to="#" errors
        const el = container.querySelector('span');
        expect(el).toBeTruthy();
        expect(el?.className).toContain('text-muted-foreground');
        expect(el?.className).not.toContain('font-medium');
    });

    it('does not apply active class to empty links (renders as span)', () => {
        const item = makeItem({ id: '1', name: 'Empty', link: '' });
        const { container } = render(<MenuItemLink item={item} pathname="" />);
        const el = container.querySelector('span');
        expect(el).toBeTruthy();
        expect(el?.className).toContain('text-muted-foreground');
        expect(el?.className).not.toContain('font-medium');
    });

    it('applies active class on exact pathname match', () => {
        const item = makeItem({ id: '1', name: 'Blog', link: '/blog' });
        const { container } = render(<MenuItemLink item={item} pathname="/blog" />);
        const link = container.querySelector('a');
        expect(link?.className).toContain('bg-accent');
    });

    it('renders renderChildren instead of item.name when provided', () => {
        const item = makeItem({ id: '1', name: 'Hidden', link: '/test' });
        render(
            <MenuItemLink item={item} pathname="/" renderChildren={<span data-testid="custom">Custom Content</span>} />,
        );
        expect(screen.getByTestId('custom')).toBeTruthy();
        expect(screen.queryByText('Hidden')).toBeNull();
    });

    it('renders external links with target=_blank when newTab is true', () => {
        const item = makeItem({ id: '1', name: 'External', link: 'https://example.com', newTab: true });
        const { container } = render(<MenuItemLink item={item} pathname="/" />);
        const link = container.querySelector('a');
        expect(link?.getAttribute('target')).toBe('_blank');
        expect(link?.getAttribute('rel')).toContain('noopener');
    });
});

// ── MenuSlotRenderer tests ───────────────────────────────────────────────

/** Helper: build resolved menu slot data for tests */
function makeSlotData(
    overrides: Partial<ResolvedMenuSlotData> & { slotName: string; menuId: string },
): ResolvedMenuSlotData {
    return {
        renderType: 'sidebar',
        sortOrder: 0,
        menu: {
            id: overrides.menuId,
            name: 'Test Menu',
            slug: 'test-menu',
            type: 'sidebar',
            items: flatItems,
        },
        ...overrides,
    };
}

describe('MenuSlotRenderer', () => {
    it('returns null when no menuSlots data provided', () => {
        const { container } = render(<MenuSlotRenderer slot="header-nav" menuSlots={null} />);
        expect(container.innerHTML).toBe('');
    });

    it('returns null when slot has no assignments', () => {
        const { container } = render(
            <MenuSlotRenderer
                slot="header-nav"
                menuSlots={{ 'sidebar-nav': [makeSlotData({ slotName: 'sidebar-nav', menuId: 'menu-1' })] }}
            />,
        );
        expect(container.innerHTML).toBe('');
    });

    it('renders fallback when slot has no assignments', () => {
        render(
            <MenuSlotRenderer
                slot="header-nav"
                menuSlots={{}}
                fallback={<span data-testid="fallback">No menu</span>}
            />,
        );
        expect(screen.getByTestId('fallback')).toBeTruthy();
    });

    it('renders menu items for assigned slot', () => {
        const menuSlots: Record<string, ResolvedMenuSlotData[]> = {
            'header-nav': [makeSlotData({ slotName: 'header-nav', menuId: 'menu-1', renderType: 'sidebar' })],
        };
        render(<MenuSlotRenderer slot="header-nav" menuSlots={menuSlots} options={{ pathname: '/' }} />);
        expect(screen.getByText('Home')).toBeTruthy();
        expect(screen.getByText('About')).toBeTruthy();
    });

    it('uses renderType from slot assignment by default', () => {
        const menuSlots: Record<string, ResolvedMenuSlotData[]> = {
            'footer-nav': [makeSlotData({ slotName: 'footer-nav', menuId: 'menu-1', renderType: 'footer' })],
        };
        const { container } = render(
            <MenuSlotRenderer slot="footer-nav" menuSlots={menuSlots} options={{ pathname: '/' }} />,
        );
        // Footer renderer uses a flat horizontal <nav>
        expect(container.querySelector('nav')).toBeTruthy();
    });

    it('allows overriding renderType via prop', () => {
        const menuSlots: Record<string, ResolvedMenuSlotData[]> = {
            'header-nav': [makeSlotData({ slotName: 'header-nav', menuId: 'menu-1', renderType: 'sidebar' })],
        };
        const { container } = render(
            <MenuSlotRenderer
                slot="header-nav"
                menuSlots={menuSlots}
                renderType="navbar"
                options={{ pathname: '/' }}
            />,
        );
        // Navbar renderer renders a horizontal nav
        expect(container.querySelector('nav')).toBeTruthy();
    });

    it('wraps content in div when className is provided', () => {
        const menuSlots: Record<string, ResolvedMenuSlotData[]> = {
            'sidebar-nav': [makeSlotData({ slotName: 'sidebar-nav', menuId: 'menu-1' })],
        };
        const { container } = render(
            <MenuSlotRenderer
                slot="sidebar-nav"
                menuSlots={menuSlots}
                className="my-custom-class"
                options={{ pathname: '/' }}
            />,
        );
        const wrapper = container.querySelector('.my-custom-class');
        expect(wrapper).toBeTruthy();
    });

    it('renders multiple menus in the same slot', () => {
        const menuSlots: Record<string, ResolvedMenuSlotData[]> = {
            'sidebar-nav': [
                makeSlotData({ slotName: 'sidebar-nav', menuId: 'menu-1', sortOrder: 0 }),
                {
                    slotName: 'sidebar-nav',
                    menuId: 'menu-2',
                    renderType: 'sidebar',
                    sortOrder: 1,
                    menu: {
                        id: 'menu-2',
                        name: 'Secondary Menu',
                        slug: 'secondary',
                        type: 'sidebar',
                        items: [makeItem({ id: '10', name: 'Settings', link: '/settings' })],
                    },
                },
            ],
        };
        render(<MenuSlotRenderer slot="sidebar-nav" menuSlots={menuSlots} options={{ pathname: '/' }} />);
        // Items from both menus should render
        expect(screen.getByText('Home')).toBeTruthy();
        expect(screen.getByText('Settings')).toBeTruthy();
    });
});
