// ---------------------------------------------------------------------------
// Ottamenu – Renderer component tests
// Tests rendering of all 6 menu types via MenuRenderer + individual renderers.
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MenuItemDto } from '../persistence/types';
import type { MenuForRender, MenuRenderType } from '../render/types';

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
    it('does not apply active class to hash-only links', () => {
        const item = makeItem({ id: '1', name: 'Placeholder', link: '#' });
        const { container } = render(<MenuItemLink item={item} pathname="#" />);
        const link = container.querySelector('a');
        // Should have inactive styles, not active 'bg-accent text-accent-foreground font-medium'
        expect(link?.className).toContain('text-muted-foreground');
        expect(link?.className).not.toContain('font-medium');
    });

    it('does not apply active class to empty links', () => {
        const item = makeItem({ id: '1', name: 'Empty', link: '' });
        const { container } = render(<MenuItemLink item={item} pathname="" />);
        const link = container.querySelector('a');
        expect(link?.className).toContain('text-muted-foreground');
        expect(link?.className).not.toContain('font-medium');
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
