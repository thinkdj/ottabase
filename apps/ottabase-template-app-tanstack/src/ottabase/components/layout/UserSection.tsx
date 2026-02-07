import { useSession } from '@/lib/auth';
import { Avatar, AvatarFallback, AvatarImage, Button } from '@ottabase/ui-shadcn';
import { Link, useNavigate } from '@tanstack/react-router';
import { LogIn, LogOut } from 'lucide-react';
import { memo, useCallback } from 'react';

export const UserSection = memo(function UserSection({ compact }: { compact?: boolean }) {
    const { isAuthenticated, user, logout } = useSession();
    const navigate = useNavigate();

    const handleLogout = useCallback(() => {
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
                <Button asChild variant="ghost" size="sm">
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
        <div className={`flex items-center gap-2 ${compact ? '' : 'ml-2 pl-2 border-l'}`}>
            <Button asChild variant="ghost" size="sm">
                <Link to="/profile" className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                        {user?.image && <AvatarImage src={user.image} />}
                        <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                    </Avatar>
                    {!compact && (user?.name || user?.email)}
                </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} title="Logout">
                <LogOut className="h-4 w-4" />
            </Button>
        </div>
    );
});
