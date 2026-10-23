import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();

const mockSession = {
    isAuthenticated: true,
    user: {
        name: 'Test User',
        email: 'test@example.com',
        image: null,
        permissions: [] as string[],
    },
    logout: vi.fn(),
};

const mockDemoMode = { enabled: false, ctaLabel: null, ctaUrl: null };

vi.mock('@/hooks/useDemoMode', () => ({
    useDemoMode: () => mockDemoMode,
}));

vi.mock('@/lib/auth', () => ({
    useSession: () => mockSession,
    isAdminUser: (user: { permissions?: string[] } | null) => !!user?.permissions?.includes('org:admin'),
}));

vi.mock('@/ottabase/config', () => ({
    MEDIA_LIBRARY_ENABLED: true,
    PACKAGES_ENABLED: { ottablog: true, referrals: true, payport: true },
    // What the client descriptors' `menu` entries produce, in list order.
    PACKAGE_ACCOUNT_LINKS: [
        { path: '/referrals', title: 'Referrals', icon: () => null, pkg: 'referrals' },
        { path: '/billing', title: 'Billing', icon: () => null, pkg: 'payport' },
    ],
}));

vi.mock('@tanstack/react-router', () => ({
    // A client-side link: the click is handled, jsdom never navigates the document.
    Link: ({ to, children, className, onClick, ...props }: any) => (
        <a
            href={to}
            className={className}
            onClick={(event) => {
                event.preventDefault();
                onClick?.(event);
            }}
            {...props}
        >
            {children}
        </a>
    ),
    useNavigate: () => mockNavigate,
}));

vi.mock('@ottabase/ui', () => {
    const AlertDialogContext = React.createContext<{
        open: boolean;
        onOpenChange?: (open: boolean) => void;
    }>({ open: false });

    const AlertDialog = ({ open, onOpenChange, children }: any) => (
        <AlertDialogContext.Provider value={{ open, onOpenChange }}>{children}</AlertDialogContext.Provider>
    );
    const AlertDialogAction = ({ children, onClick, ...props }: any) => (
        <button type="button" onClick={onClick} {...props}>
            {children}
        </button>
    );
    const AlertDialogCancel = ({ children, onClick, ...props }: any) => {
        const dialog = React.useContext(AlertDialogContext);

        return (
            <button
                type="button"
                onClick={(event) => {
                    onClick?.(event);
                    dialog.onOpenChange?.(false);
                }}
                {...props}
            >
                {children}
            </button>
        );
    };
    const AlertDialogContent = ({ children }: any) => {
        const dialog = React.useContext(AlertDialogContext);

        return dialog.open ? <div role="alertdialog">{children}</div> : null;
    };
    const AlertDialogDescription = ({ children }: any) => <p>{children}</p>;
    const AlertDialogTitle = ({ children }: any) => <h2>{children}</h2>;

    return {
        cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' '),
        buttonVariants: () => '',
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
        AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
        AlertDialogTitle,
        // The real ConfirmDialog, reduced to the props the account menu passes
        ConfirmDialog: ({
            open,
            onOpenChange,
            title,
            description,
            primaryActionText,
            secondaryActionText,
            onConfirm,
            onCancel,
        }: any) => (
            <AlertDialog open={open} onOpenChange={onOpenChange}>
                <AlertDialogContent>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                    <AlertDialogCancel onClick={onCancel}>{secondaryActionText}</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>{primaryActionText}</AlertDialogAction>
                </AlertDialogContent>
            </AlertDialog>
        ),
        Avatar: ({ children, className }: any) => <div className={className}>{children}</div>,
        AvatarFallback: ({ children, className }: any) => <span className={className}>{children}</span>,
        AvatarImage: ({ src }: any) => <img src={src} alt="" />,
        Button: React.forwardRef(({ children, asChild, ...props }: any, ref: any) => {
            if (asChild && React.isValidElement(children)) {
                return React.cloneElement(children, { ...props, ref });
            }

            return (
                <button ref={ref} type="button" {...props}>
                    {children}
                </button>
            );
        }),
        // Account menu: render inline so items are queryable without Radix portals
        DropdownMenu: ({ children }: any) => <div data-testid="account-menu">{children}</div>,
        DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
        DropdownMenuContent: ({ children }: any) => <div role="menu">{children}</div>,
        DropdownMenuItem: ({ children, asChild, onSelect }: any) =>
            asChild ? (
                children
            ) : (
                <button type="button" role="menuitem" onClick={onSelect}>
                    {children}
                </button>
            ),
        DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
        DropdownMenuSeparator: () => <hr />,
    };
});

vi.mock('lucide-react', () => ({
    ChevronsUpDown: () => null,
    Images: () => null,
    LogIn: () => <span data-testid="icon-login" />,
    LogOut: () => null,
    PenLine: () => null,
    ShieldCheck: () => null,
    UserRound: () => null,
}));

import { AccountLinks, AccountMenu } from '../AccountMenu';

describe('AccountMenu', () => {
    beforeEach(() => {
        mockSession.isAuthenticated = true;
        mockSession.user = {
            name: 'Test User',
            email: 'test@example.com',
            image: null,
            permissions: [],
        };
        mockSession.logout.mockReset();
        mockNavigate.mockReset();
        mockDemoMode.enabled = false;
    });

    it('shows login and sign up when not authenticated', () => {
        mockSession.isAuthenticated = false;

        render(<AccountMenu />);

        expect(screen.getByRole('link', { name: /Login/ })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
        expect(screen.queryByTestId('account-menu')).not.toBeInTheDocument();
    });

    it('shows the account destinations in the menu', () => {
        render(<AccountMenu />);

        const menu = screen.getByRole('menu');
        expect(within(menu).getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
        expect(within(menu).getByRole('link', { name: 'Media Library' })).toHaveAttribute('href', '/media-library');
        expect(within(menu).getByRole('link', { name: 'Referrals' })).toHaveAttribute('href', '/referrals');
    });

    it('links every package page that asks for it, after the core destinations', () => {
        render(<AccountMenu />);

        const labels = within(screen.getByRole('menu'))
            .getAllByRole('link')
            .map((link) => link.textContent);
        expect(labels).toEqual(['Profile', 'Media Library', 'Referrals', 'Billing']);
    });

    it('marks the Ottabase Pro pages, and only on a public demo', () => {
        mockDemoMode.enabled = true;
        render(<AccountMenu />);

        const menu = within(screen.getByRole('menu'));
        expect(menu.getByRole('link', { name: /^Billing\s*Pro$/ })).toHaveAttribute('href', '/billing');
        expect(menu.getByRole('link', { name: 'Referrals' })).toBeInTheDocument();
    });

    it('offers a visitor Login from the sidebar and the floating button', () => {
        mockSession.isAuthenticated = false;

        for (const variant of ['sidebar', 'floating'] as const) {
            const { unmount } = render(<AccountMenu variant={variant} />);
            expect(screen.getByRole('link', { name: /Login/ })).toHaveAttribute('href', '/login');
            expect(screen.queryByTestId('account-menu')).not.toBeInTheDocument();
            unmount();
        }
    });

    it('lists the same destinations in the drawer, and logs out behind the same confirmation', () => {
        mockSession.user.permissions = ['org:admin'];
        const onNavigate = vi.fn();

        render(<AccountLinks onNavigate={onNavigate} />);

        const nav = screen.getByRole('navigation', { name: 'Account' });
        expect(
            within(nav)
                .getAllByRole('link')
                .map((link) => link.getAttribute('href')),
        ).toEqual(['/profile', '/media-library', '/referrals', '/billing', '/admin']);
        fireEvent.click(within(nav).getByRole('link', { name: 'Billing' }));
        expect(onNavigate).toHaveBeenCalledTimes(1);

        fireEvent.click(within(nav).getByRole('button', { name: 'Log out' }));
        fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Log out' }));
        expect(mockSession.logout).toHaveBeenCalledTimes(1);
        expect(onNavigate).toHaveBeenCalledTimes(2);
        expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });

    it('gates Studio on posts:update and Admin on admin access', () => {
        render(<AccountMenu />);
        expect(screen.queryByRole('link', { name: 'Studio' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    });

    it('shows Studio and Admin for a privileged user', () => {
        mockSession.user.permissions = ['posts:update', 'org:admin'];

        render(<AccountMenu />);

        expect(screen.getByRole('link', { name: 'Studio' })).toHaveAttribute('href', '/studio');
        expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
    });

    it('asks for confirmation before logging out', () => {
        render(<AccountMenu />);

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));

        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Log out?' })).toBeInTheDocument();
        expect(mockSession.logout).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('closes the dialog without logging out when cancelled', () => {
        render(<AccountMenu />);

        fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(mockSession.logout).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('logs out and redirects home after confirmation', () => {
        render(<AccountMenu />);

        fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
        fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Log out' }));

        expect(mockSession.logout).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });
});
