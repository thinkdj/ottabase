import { useSession } from '@/lib/auth';
import { rememberReturnPath } from '@/lib/auth-redirect';
import { AUTH_STORAGE_KEY } from '@ottabase/auth/react';
import { Spinner } from '@ottabase/ui-shadcn';
import { useNavigate } from '@tanstack/react-router';
import { ReactNode, useEffect, useRef, useState } from 'react';

interface ProtectedRouteProps {
    children: ReactNode;
    redirectTo?: string;
    requiredPermissions?: string[];
    requiredRoles?: string[];
    requireSystemAdmin?: boolean;
    fallback?: ReactNode;
}

/**
 ** IMP: Check localStorage synchronously to avoid atom hydration flash
 */
function hasValidStoredSession(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!stored) return false;
        const session = JSON.parse(stored);
        return session?.expires && Number(session.expires) > Date.now();
    } catch {
        return false;
    }
}

export function ProtectedRoute({
    children,
    redirectTo = '/login',
    requiredPermissions,
    requiredRoles,
    requireSystemAdmin = false,
    fallback,
}: ProtectedRouteProps) {
    const navigate = useNavigate();
    const { isAuthenticated, isLoading, user } = useSession({ skipAutoSync: true });
    const hasRedirected = useRef(false);
    // Check storage on mount to prevent hydration flash
    const [initialCheck] = useState(hasValidStoredSession);

    useEffect(() => {
        if (hasRedirected.current || isLoading) return;

        // Wait for atom hydration if we know there's a session in storage
        if (initialCheck && !isAuthenticated) return;

        // Only redirect if definitely not authenticated
        if (!isAuthenticated) {
            hasRedirected.current = true;
            rememberReturnPath();
            navigate({ to: redirectTo, replace: true });
        }
    }, [isAuthenticated, isLoading, initialCheck, navigate, redirectTo]);

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

    const hasRequiredRoles =
        !requiredRoles || requiredRoles.length === 0 || requiredRoles.some((role) => user?.roles?.includes(role));

    const hasRequiredPermissions =
        !requiredPermissions ||
        requiredPermissions.length === 0 ||
        requiredPermissions.every((perm) => {
            // Mirror backend logic: 'admin' permission is satisfied by owner or admin role,
            // or by wildcard '*:*' permission (see packages/rbac/src/admin-guard.ts)
            if (perm === 'admin') {
                return (
                    user?.roles?.includes('owner') ||
                    user?.roles?.includes('admin') ||
                    user?.permissions?.includes('*:*')
                );
            }
            return user?.permissions?.includes('*:*') || user?.permissions?.includes(perm);
        });

    const hasRequiredSystemAdmin = !requireSystemAdmin || user?.systemAdmin === true;

    if (!hasRequiredRoles || !hasRequiredPermissions || !hasRequiredSystemAdmin) {
        if (fallback) return <>{fallback}</>;
        return (
            <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
                Access denied
            </div>
        );
    }

    return <>{children}</>;
}
