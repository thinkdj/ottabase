import { ReactNode, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useSession } from '@/lib/auth';
import { Spinner } from '@ottabase/ui-shadcn';

interface ProtectedRouteProps {
    children: ReactNode;
    redirectTo?: string;
}

export function ProtectedRoute({ children, redirectTo = '/login' }: ProtectedRouteProps) {
    const navigate = useNavigate();
    const { isAuthenticated, isLoading } = useSession();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            navigate({ to: redirectTo });
        }
    }, [isAuthenticated, isLoading, navigate, redirectTo]);

    if (isLoading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="text-center space-y-4">
                    <Spinner className="h-8 w-8 mx-auto" />
                    <p className="text-sm text-muted-foreground">Checking authentication...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null; // Will redirect via useEffect
    }

    return <>{children}</>;
}
