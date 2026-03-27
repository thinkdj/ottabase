import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();

const mockSession = {
    isAuthenticated: true,
    user: {
        name: 'Test User',
        email: 'test@example.com',
        image: null,
    },
    logout: vi.fn(),
};

vi.mock('@/lib/auth', () => ({
    useSession: () => mockSession,
}));

vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children, className, ...props }: any) => (
        <a href={to} className={className} {...props}>
            {children}
        </a>
    ),
    useNavigate: () => mockNavigate,
}));

vi.mock('@ottabase/ui-shadcn', () => {
    const AlertDialogContext = React.createContext<{
        open: boolean;
        onOpenChange?: (open: boolean) => void;
    }>({ open: false });

    return {
        AlertDialog: ({ open, onOpenChange, children }: any) => (
            <AlertDialogContext.Provider value={{ open, onOpenChange }}>{children}</AlertDialogContext.Provider>
        ),
        AlertDialogAction: ({ children, onClick, ...props }: any) => (
            <button type="button" onClick={onClick} {...props}>
                {children}
            </button>
        ),
        AlertDialogCancel: ({ children, ...props }: any) => {
            const dialog = React.useContext(AlertDialogContext);

            return (
                <button type="button" onClick={() => dialog.onOpenChange?.(false)} {...props}>
                    {children}
                </button>
            );
        },
        AlertDialogContent: ({ children }: any) => {
            const dialog = React.useContext(AlertDialogContext);

            return dialog.open ? <div role="alertdialog">{children}</div> : null;
        },
        AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
        AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
        AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
        AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
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
    };
});

vi.mock('lucide-react', () => ({
    LogIn: () => <span data-testid="icon-login" />,
    LogOut: () => <span data-testid="icon-logout" />,
}));

import { UserSection } from '../UserSection';

describe('UserSection', () => {
    beforeEach(() => {
        mockSession.isAuthenticated = true;
        mockSession.user = {
            name: 'Test User',
            email: 'test@example.com',
            image: null,
        };
        mockSession.logout.mockReset();
        mockNavigate.mockReset();
    });

    it('asks for confirmation before logging out', () => {
        render(<UserSection />);

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Logout'));

        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Log out?' })).toBeInTheDocument();
        expect(mockSession.logout).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('closes the dialog without logging out when cancelled', () => {
        render(<UserSection />);

        fireEvent.click(screen.getByTitle('Logout'));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(mockSession.logout).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('logs out and redirects home after confirmation', () => {
        render(<UserSection />);

        fireEvent.click(screen.getByTitle('Logout'));
        fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

        expect(mockSession.logout).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });
});
