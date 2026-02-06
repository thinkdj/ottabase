import type { LayoutConfig } from '@ottabase/brand-engine';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock TanStack Router
const mockUseLocation = vi.fn().mockReturnValue({ pathname: '/' });
const mockUseNavigate = vi.fn().mockReturnValue(vi.fn());

vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children, className, onClick, ...props }: any) => (
        <a href={to} className={className} onClick={onClick} data-testid={`link-${to}`} {...props}>
            {children}
        </a>
    ),
    Outlet: () => <div data-testid="outlet">Page Content</div>,
    useLocation: () => mockUseLocation(),
    useNavigate: () => mockUseNavigate(),
}));

// Mock auth
const mockSession = {
    isAuthenticated: false,
    user: null,
    logout: vi.fn(),
};
vi.mock('@/lib/auth', () => ({
    useSession: () => mockSession,
}));

// Mock theme context
const mockThemeState = {
    theme: 'default',
    setTheme: vi.fn(),
    config: {} as any,
    resolved: null,
    layout: null as LayoutConfig | null,
    layoutOverrides: {},
    setLayoutOverrides: vi.fn(),
    resetLayoutOverrides: vi.fn(),
};
vi.mock('@/ottabase/providers/ThemeContext', () => ({
    useTheme: () => mockThemeState,
}));

// Mock components used inside BrandLayout
vi.mock('@/ottabase/components/ThemeSwitcher', () => ({
    ThemeSwitcher: () => <div data-testid="theme-switcher" />,
}));
vi.mock('@ottabase/ui-components/dark-mode-toggle', () => ({
    DarkModeToggle: (props: any) => <button data-testid="dark-mode-toggle" {...props} />,
}));
vi.mock('@/components/LanguageSwitcher', () => ({
    LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));
vi.mock('@/components/OrganizationSwitcher', () => ({
    OrganizationSwitcher: () => <div data-testid="org-switcher" />,
}));
vi.mock('@/components/ReferralTracker', () => ({
    ReferralTracker: () => <div data-testid="referral-tracker" />,
}));
vi.mock('@/hooks/useLocalStorage', () => ({
    useLocalStorage: () => [null, vi.fn()],
}));
vi.mock('@/ottabase/config/app.config', () => ({
    APP_META: { appName: 'Test App' },
}));
vi.mock('@/ottabase/config/i18n.config', () => ({
    i18nConfig: { enabledLanguages: ['en'] },
}));
vi.mock('@ottabase/ui-shadcn', () => ({
    Avatar: ({ children, className }: any) => <div className={className}>{children}</div>,
    AvatarFallback: ({ children }: any) => <span>{children}</span>,
    AvatarImage: ({ src }: any) => <img src={src} alt="" />,
    Button: React.forwardRef(({ children, asChild, variant, size, ...props }: any, ref: any) => (
        <button ref={ref} data-variant={variant} {...props}>
            {children}
        </button>
    )),
}));
vi.mock('lucide-react', () => ({
    LogIn: () => <span data-testid="icon-login" />,
    LogOut: () => <span data-testid="icon-logout" />,
    Menu: () => <span data-testid="icon-menu" />,
    X: () => <span data-testid="icon-close" />,
}));

import { BrandLayout } from '../BrandLayout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setLayout(overrides: Partial<LayoutConfig>) {
    mockThemeState.layout = {
        header: 'topbar',
        navigation: 'topbar',
        contentWidth: 'fixed',
        footer: true,
        density: 'comfy',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BrandLayout', () => {
    beforeEach(() => {
        mockThemeState.layout = null;
        mockSession.isAuthenticated = false;
        mockSession.user = null;
        mockUseLocation.mockReturnValue({ pathname: '/' });
    });

    // =======================================================================
    // Header variants
    // =======================================================================

    describe('header variants', () => {
        it('renders topbar header with app name', () => {
            setLayout({ header: 'topbar' });
            render(<BrandLayout />);
            expect(screen.getByText('Test App')).toBeTruthy();
        });

        it('renders topbar header with navigation when navigation is topbar', () => {
            setLayout({ header: 'topbar', navigation: 'topbar' });
            render(<BrandLayout />);
            // "/" link appears twice: logo link + nav "Home" link
            expect(screen.getAllByTestId('link-/').length).toBeGreaterThanOrEqual(2);
            expect(screen.getByTestId('link-/blog')).toBeTruthy();
            expect(screen.getByTestId('link-/demo')).toBeTruthy();
        });

        it('renders minimal header', () => {
            setLayout({ header: 'minimal', navigation: 'topbar' });
            render(<BrandLayout />);
            expect(screen.getByText('Test App')).toBeTruthy();
        });

        it('renders no header when header is none', () => {
            setLayout({ header: 'none', navigation: 'topbar' });
            render(<BrandLayout />);
            // The outlet still renders
            expect(screen.getByTestId('outlet')).toBeTruthy();
        });
    });

    // =======================================================================
    // Navigation variants
    // =======================================================================

    describe('navigation variants', () => {
        it('renders sidebar navigation for sidebar layout', () => {
            setLayout({ navigation: 'sidebar' });
            const { container } = render(<BrandLayout />);
            const aside = container.querySelector('aside');
            expect(aside).toBeTruthy();
        });

        it('sidebar contains nav links', () => {
            setLayout({ navigation: 'sidebar' });
            render(<BrandLayout />);
            // Sidebar links present
            expect(screen.getByTestId('link-/blog')).toBeTruthy();
            expect(screen.getByTestId('link-/admin')).toBeTruthy();
        });

        it('renders drawer trigger for drawer navigation', () => {
            setLayout({ header: 'topbar', navigation: 'drawer' });
            render(<BrandLayout />);
            expect(screen.getByTestId('icon-menu')).toBeTruthy();
        });

        it('does not render sidebar for topbar navigation', () => {
            setLayout({ navigation: 'topbar' });
            const { container } = render(<BrandLayout />);
            const aside = container.querySelector('aside');
            expect(aside).toBeNull();
        });
    });

    // =======================================================================
    // Footer
    // =======================================================================

    describe('footer', () => {
        it('renders footer when footer is true', () => {
            setLayout({ footer: true });
            render(<BrandLayout />);
            expect(screen.getByText('Built with Ottabase')).toBeTruthy();
        });

        it('does not render footer when footer is false', () => {
            setLayout({ footer: false });
            render(<BrandLayout />);
            expect(screen.queryByText('Built with Ottabase')).toBeNull();
        });
    });

    // =======================================================================
    // Content area
    // =======================================================================

    describe('content area', () => {
        it('always renders the Outlet', () => {
            setLayout({});
            render(<BrandLayout />);
            expect(screen.getByTestId('outlet')).toBeTruthy();
        });

        it('renders referral tracker', () => {
            setLayout({});
            render(<BrandLayout />);
            expect(screen.getByTestId('referral-tracker')).toBeTruthy();
        });
    });

    // =======================================================================
    // Responsive sidebar (xs full-width)
    // =======================================================================

    describe('responsive sidebar classes', () => {
        it('sidebar has full-width class for mobile and fixed width for desktop', () => {
            setLayout({ navigation: 'sidebar' });
            const { container } = render(<BrandLayout />);
            const aside = container.querySelector('aside');
            expect(aside?.className).toContain('w-full');
            expect(aside?.className).toContain('md:w-56');
        });

        it('body container uses flex-col on mobile and flex-row on desktop', () => {
            setLayout({ navigation: 'sidebar' });
            const { container } = render(<BrandLayout />);
            // The flex container wrapping sidebar + main
            const flexContainer = container.querySelector('.flex.flex-col.md\\:flex-row');
            expect(flexContainer).toBeTruthy();
        });

        it('sidebar nav is horizontal on mobile (flex) and vertical on desktop (md:flex-col)', () => {
            setLayout({ navigation: 'sidebar' });
            const { container } = render(<BrandLayout />);
            const nav = container.querySelector('aside nav');
            expect(nav?.className).toContain('flex');
            expect(nav?.className).toContain('md:flex-col');
        });
    });

    // =======================================================================
    // Auth-dependent links
    // =======================================================================

    describe('auth-dependent navigation', () => {
        it('hides auth-required links when not authenticated', () => {
            mockSession.isAuthenticated = false;
            setLayout({ navigation: 'sidebar' });
            render(<BrandLayout />);
            expect(screen.queryByTestId('link-/dashboard')).toBeNull();
            expect(screen.queryByTestId('link-/referrals')).toBeNull();
        });

        it('shows auth-required links when authenticated', () => {
            mockSession.isAuthenticated = true;
            mockSession.user = { name: 'Test User', email: 'test@example.com' } as any;
            setLayout({ navigation: 'sidebar' });
            render(<BrandLayout />);
            expect(screen.getByTestId('link-/dashboard')).toBeTruthy();
            expect(screen.getByTestId('link-/referrals')).toBeTruthy();
        });

        it('shows login button when not authenticated', () => {
            mockSession.isAuthenticated = false;
            setLayout({});
            render(<BrandLayout />);
            expect(screen.getByTestId('link-/login')).toBeTruthy();
        });
    });

    // =======================================================================
    // Controls section
    // =======================================================================

    describe('controls', () => {
        it('renders theme switcher and dark mode toggle', () => {
            setLayout({ header: 'topbar' });
            render(<BrandLayout />);
            expect(screen.getByTestId('theme-switcher')).toBeTruthy();
            expect(screen.getByTestId('dark-mode-toggle')).toBeTruthy();
        });

        it('renders language switcher', () => {
            setLayout({ header: 'topbar' });
            render(<BrandLayout />);
            expect(screen.getByTestId('language-switcher')).toBeTruthy();
        });
    });

    // =======================================================================
    // Default layout (null config)
    // =======================================================================

    describe('default layout when config is null', () => {
        it('renders with defaults when layout is null', () => {
            mockThemeState.layout = null;
            render(<BrandLayout />);
            // Should still render with topbar header default
            expect(screen.getByText('Test App')).toBeTruthy();
            expect(screen.getByTestId('outlet')).toBeTruthy();
        });
    });
});
