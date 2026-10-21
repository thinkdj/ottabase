import type { LayoutConfig } from '@ottabase/ottalayout';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    // BrandHeaders / SidebarNav / DrawerNav gate the "Admin" nav entry on these. The public-layout
    // tests here don't exercise an admin user, so return false.
    isAdminUser: () => false,
    isPlatformAdmin: () => false,
    isOrgAdmin: () => false,
}));

// Mock components used inside the layout
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
vi.mock('@/ottabase/config', () => ({
    APP_META: { appName: 'Test App', tagline: 'Test Tagline' },
    APP_ID: 'test-app',
    APP_NAME: 'Test App',
    MEDIA_LIBRARY_ENABLED: true,
    PACKAGES_ENABLED: { ottablog: true, shortlinks: true, referrals: true },
    PACKAGE_ACCOUNT_LINKS: [{ path: '/referrals', title: 'Referrals', icon: () => null, pkg: 'referrals' }],
}));
vi.mock('@/ottabase/config/i18n.config', () => ({
    i18nConfig: { enabledLanguages: ['en'] },
}));
vi.mock('@ottabase/ui-shadcn', () => ({
    cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' '),
    buttonVariants: () => '',
    AlertDialog: ({ children }: any) => <div data-testid="alert-dialog">{children}</div>,
    AlertDialogAction: ({ children, onClick, ...props }: any) => (
        <button data-testid="alert-dialog-action" onClick={onClick} {...props}>
            {children}
        </button>
    ),
    AlertDialogCancel: ({ children, ...props }: any) => (
        <button data-testid="alert-dialog-cancel" {...props}>
            {children}
        </button>
    ),
    AlertDialogContent: ({ children }: any) => <div data-testid="alert-dialog-content">{children}</div>,
    AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
    AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
    AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
    Avatar: ({ children, className }: any) => <div className={className}>{children}</div>,
    AvatarFallback: ({ children }: any) => <span>{children}</span>,
    AvatarImage: ({ src }: any) => <img src={src} alt="" />,
    Button: React.forwardRef(({ children, asChild, variant, size, ...props }: any, ref: any) => (
        <button ref={ref} data-variant={variant} {...props}>
            {children}
        </button>
    )),
    // Account menu: render everything inline so menu items are queryable without opening
    DropdownMenu: ({ children }: any) => <div data-testid="account-menu">{children}</div>,
    DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
    DropdownMenuItem: ({ children, asChild, onSelect }: any) =>
        asChild ? children : <button onClick={onSelect}>{children}</button>,
    DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
    DropdownMenuSeparator: () => <hr />,
}));
vi.mock('lucide-react', () => ({
    ChevronsUpDown: () => null,
    Images: () => null,
    PenLine: () => null,
    ShieldCheck: () => null,
    UserRound: () => null,
    LogIn: () => <span data-testid="icon-login" />,
    LogOut: () => <span data-testid="icon-logout" />,
    Menu: () => <span data-testid="icon-menu" />,
    X: () => <span data-testid="icon-close" />,
}));

// SidebarNav uses useApiQuery; mock to avoid QueryClientProvider in tests
vi.mock('@ottabase/ottaorm/client', () => ({
    useApiQuery: () => ({ data: null, isLoading: false }),
}));

// TopbarHeader, SidebarNav, BrandFooter use useBrand; mock so they use legacy/fallback content
vi.mock('@ottabase/brand-engine-react', () => ({
    useBrand: () => ({ config: null, isLoading: false, error: null, refresh: vi.fn() }),
}));

import { ConfigurableLayout } from '../ConfigurableLayout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let layout: LayoutConfig | null = null;

function setLayout(overrides: Partial<LayoutConfig>) {
    layout = {
        header: 'topbar',
        navigation: 'topbar',
        contentWidth: 'md',
        footer: true,
        density: 'comfy',
        ...overrides,
    };
}

function renderLayout() {
    return render(
        <ConfigurableLayout config={layout as LayoutConfig}>
            <div data-testid="outlet">Page Content</div>
        </ConfigurableLayout>,
    );
}

function signIn() {
    mockSession.isAuthenticated = true;
    mockSession.user = { name: 'Test User', email: 'test@example.com' } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConfigurableLayout', () => {
    beforeEach(() => {
        layout = null;
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
            renderLayout();
            expect(screen.getByText('Test App')).toBeTruthy();
        });

        it('renders the configured meta.tagline beside the app name, not a framework name', () => {
            setLayout({ header: 'topbar' });
            renderLayout();
            expect(screen.getByText('Test Tagline')).toBeTruthy();
            expect(screen.queryByText('TanStack')).toBeNull();
        });

        it('renders topbar header with navigation when navigation is topbar', () => {
            setLayout({ header: 'topbar', navigation: 'topbar' });
            renderLayout();
            // "/" link appears twice: logo link + nav "Home" link
            expect(screen.getAllByTestId('link-/').length).toBeGreaterThanOrEqual(2);
            expect(screen.getByTestId('link-/blog')).toBeTruthy();
            expect(screen.getByTestId('link-/demo')).toBeTruthy();
        });

        it('renders minimal header', () => {
            setLayout({ header: 'minimal', navigation: 'topbar' });
            renderLayout();
            expect(screen.getByText('Test App')).toBeTruthy();
        });

        it('renders no header when header is none', () => {
            setLayout({ header: 'none', navigation: 'topbar' });
            renderLayout();
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
            const { container } = renderLayout();
            const aside = container.querySelector('aside');
            expect(aside).toBeTruthy();
        });

        it('sidebar contains nav links', () => {
            setLayout({ navigation: 'sidebar' });
            renderLayout();
            // Sidebar links present: the public ones only
            expect(screen.getByTestId('link-/blog')).toBeTruthy();
            expect(screen.getByTestId('link-/changelog')).toBeTruthy();
        });

        it('renders drawer trigger for drawer navigation', () => {
            setLayout({ header: 'topbar', navigation: 'drawer' });
            renderLayout();
            expect(screen.getByTestId('icon-menu')).toBeTruthy();
        });

        it('does not render sidebar for topbar navigation', () => {
            setLayout({ navigation: 'topbar' });
            const { container } = renderLayout();
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
            renderLayout();
            expect(screen.getByText('Built with Ottabase')).toBeTruthy();
        });

        it('does not render footer when footer is false', () => {
            setLayout({ footer: false });
            renderLayout();
            expect(screen.queryByText('Built with Ottabase')).toBeNull();
        });
    });

    // =======================================================================
    // Content area
    // =======================================================================

    describe('content area', () => {
        it('always renders the Outlet', () => {
            setLayout({});
            renderLayout();
            expect(screen.getByTestId('outlet')).toBeTruthy();
        });

        it('renders referral tracker', () => {
            setLayout({});
            renderLayout();
            expect(screen.getByTestId('referral-tracker')).toBeTruthy();
        });
    });

    // =======================================================================
    // Responsive sidebar (xs full-width)
    // =======================================================================

    describe('responsive sidebar classes', () => {
        it('sidebar has full-width class for mobile and CSS custom property for desktop width', () => {
            setLayout({ navigation: 'sidebar' });
            const { container } = renderLayout();
            const aside = container.querySelector('aside');
            expect(aside?.className).toContain('w-full');
            // Desktop width is now set via CSS custom property instead of a Tailwind class
            expect(aside?.getAttribute('style')).toContain('--sidebar-width');
        });

        it('body container uses flex-col on mobile and flex-row on desktop', () => {
            setLayout({ navigation: 'sidebar' });
            const { container } = renderLayout();
            // The flex container wrapping sidebar + main
            const flexContainer = container.querySelector('.flex.flex-col.md\\:flex-row');
            expect(flexContainer).toBeTruthy();
        });

        it('sidebar nav is horizontal on mobile (flex) and vertical on desktop (md:flex-col)', () => {
            setLayout({ navigation: 'sidebar' });
            const { container } = renderLayout();
            const nav = container.querySelector('aside nav');
            expect(nav?.className).toContain('flex');
            expect(nav?.className).toContain('md:flex-col');
        });
    });

    // =======================================================================
    // Auth-dependent links
    // =======================================================================

    describe('auth-dependent navigation', () => {
        it('keeps the nav visitor-facing: no signed-in destinations when not authenticated', () => {
            mockSession.isAuthenticated = false;
            setLayout({ navigation: 'sidebar' });
            renderLayout();
            expect(screen.queryByTestId('link-/profile')).toBeNull();
            expect(screen.queryByTestId('link-/referrals')).toBeNull();
        });

        it('shows signed-in destinations in the account menu, not the nav, when authenticated', () => {
            mockSession.isAuthenticated = true;
            mockSession.user = { name: 'Test User', email: 'test@example.com' } as any;
            setLayout({ navigation: 'sidebar' });
            renderLayout();
            const accountMenu = screen.getByTestId('account-menu');
            expect(accountMenu.querySelector('[data-testid="link-/profile"]')).toBeTruthy();
            expect(accountMenu.querySelector('[data-testid="link-/referrals"]')).toBeTruthy();
            // The sidebar nav itself stays public
            const aside = document.querySelector('aside');
            expect(aside?.querySelector('[data-testid="link-/referrals"]')).toBeNull();
        });

        it('shows login button when not authenticated', () => {
            mockSession.isAuthenticated = false;
            setLayout({});
            renderLayout();
            expect(screen.getByTestId('link-/login')).toBeTruthy();
        });
    });

    // =======================================================================
    // Controls section
    // =======================================================================

    describe('controls', () => {
        it('renders dark mode toggle', () => {
            setLayout({ header: 'topbar' });
            renderLayout();
            expect(screen.getByTestId('dark-mode-toggle')).toBeTruthy();
        });

        it('renders language switcher', () => {
            setLayout({ header: 'topbar' });
            renderLayout();
            expect(screen.getByTestId('language-switcher')).toBeTruthy();
        });
    });

    // =======================================================================
    // Default layout (null config)
    // =======================================================================

    describe('default layout when config is null', () => {
        it('renders with defaults when layout is null', () => {
            layout = null;
            renderLayout();
            // Should still render with topbar header default
            expect(screen.getByText('Test App')).toBeTruthy();
            expect(screen.getByTestId('outlet')).toBeTruthy();
        });
    });

    // =======================================================================
    // Where the account menu goes
    // =======================================================================

    describe('account placement', () => {
        const accountMenus = () => screen.queryAllByTestId('account-menu');

        it('has one account menu, in the header, when there is a header', () => {
            signIn();
            setLayout({ header: 'topbar', navigation: 'sidebar' });
            renderLayout();
            expect(accountMenus()).toHaveLength(1);
            expect(document.querySelector('aside [data-testid="account-menu"]')).toBeNull();
            expect(screen.getByTestId('link-/referrals')).toBeTruthy();
        });

        it('moves it to the foot of the sidebar when there is no header', () => {
            signIn();
            setLayout({ header: 'none', navigation: 'sidebar' });
            renderLayout();
            expect(document.querySelector('header')).toBeNull();
            const menu = document.querySelector('aside [data-testid="account-menu"]');
            expect(menu?.querySelector('[data-testid="link-/profile"]')).toBeTruthy();
            expect(document.querySelector('aside')?.className).toContain('md:h-dvh');
        });

        it('offers Login at the foot of a headerless sidebar to a visitor', () => {
            setLayout({ header: 'none', navigation: 'sidebar' });
            renderLayout();
            expect(document.querySelector('aside [data-testid="link-/login"]')).toBeTruthy();
        });

        it('lists the account links in the drawer when there is no header', () => {
            signIn();
            setLayout({ header: 'none', navigation: 'drawer' });
            renderLayout();
            fireEvent.click(screen.getByTitle('Open menu'));
            const drawer = screen.getByRole('dialog', { name: 'Navigation Menu' });
            const account = within(drawer).getByRole('navigation', { name: 'Account' });
            expect(within(account).getByTestId('link-/profile')).toBeTruthy();
            expect(within(account).getByTestId('link-/referrals')).toBeTruthy();
            expect(within(account).getByText('Log out')).toBeTruthy();
        });

        it('keeps the drawer to the nav when the header holds the account menu', () => {
            signIn();
            setLayout({ header: 'topbar', navigation: 'drawer' });
            renderLayout();
            fireEvent.click(screen.getByTitle('Open menu'));
            const drawer = screen.getByRole('dialog', { name: 'Navigation Menu' });
            expect(within(drawer).queryByRole('navigation', { name: 'Account' })).toBeNull();
        });

        it('renders no account menu on a chrome-free layout unless it asks for the floating button', () => {
            signIn();
            setLayout({ header: 'none', navigation: 'none' });
            const { unmount } = renderLayout();
            expect(accountMenus()).toHaveLength(0);
            unmount();

            setLayout({ header: 'none', navigation: 'none', floatingAccount: true });
            renderLayout();
            expect(accountMenus()).toHaveLength(1);
            expect(screen.getByTestId('account-menu').closest('.fixed')?.className).toContain('right-4');
        });
    });
});
