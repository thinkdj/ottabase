import { useSession } from '@/lib/auth';
import { ConfirmDialog } from '@ottabase/ui-components';
import { Avatar, AvatarFallback, AvatarImage, Button } from '@ottabase/ui-shadcn';
import { Link, useNavigate } from '@tanstack/react-router';
import { LogIn, LogOut } from 'lucide-react';
import { memo, useCallback, useState } from 'react';

export const UserSection = memo(function UserSection({ compact }: { compact?: boolean }) {
    const { isAuthenticated, user, logout } = useSession();
    const navigate = useNavigate();
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

    const handleConfirmLogout = useCallback(() => {
        setLogoutConfirmOpen(false);
        logout();
        navigate({ to: '/' });
    }, [logout, navigate]);

    const userInitials =
        user?.name && user.name.trim().length > 0
            ? user.name
                  .split(' ')
                  .filter((n: string) => n.length > 0)
                  .map((n: string) => n[0])
                  .join('')
                  .toUpperCase()
            : user?.email && user.email.length > 0
              ? user.email[0].toUpperCase()
              : '?';

    if (!isAuthenticated) {
        return (
            <div className={`flex items-center gap-2 ${compact ? '' : 'ml-2'}`}>
                {/* Login carries mobile — the login page links to registration, so Sign up can yield */}
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                    <Link to="/register">Sign up</Link>
                </Button>
                <Button asChild variant="default" size="sm">
                    <Link to="/login" className="flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
                        Login
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <>
            <div className={`flex items-center gap-2 ${compact ? '' : 'ml-2 border-l border-border/60 pl-2'}`}>
                <Button asChild variant="ghost" size="sm">
                    <Link to="/profile" className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 ring-1 ring-border">
                            {user?.image && <AvatarImage src={user.image} />}
                            <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                        </Avatar>
                        {/* The avatar identifies the user on narrow headers; the name returns from md up */}
                        {!compact && (
                            <span className="hidden max-w-[10rem] truncate md:inline">{user?.name || user?.email}</span>
                        )}
                    </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setLogoutConfirmOpen(true)} title="Logout">
                    <LogOut className="h-4 w-4" />
                </Button>
            </div>

            <ConfirmDialog
                open={logoutConfirmOpen}
                onOpenChange={setLogoutConfirmOpen}
                title="Log out?"
                description="You will be signed out of your current session and returned to the home page."
                secondaryActionText="Cancel"
                primaryActionText="Log out"
                onConfirm={handleConfirmLogout}
            />
        </>
    );
});
