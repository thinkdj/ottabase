import { isPlatformAdmin, useSession } from '@/lib/auth';
import { rememberReturnPath } from '@/lib/auth-redirect';
import { Spinner } from '@ottabase/ui-shadcn';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useEffect, useRef } from 'react';

function matchesPermission(held: string, required: string): boolean {
    if (held === required) return true;
    const [hRes, hAct] = held.split(':');
    const [rRes, rAct] = required.split(':');
    if (hRes === '*' && hAct === '*') return true;
    return (hRes === '*' || hRes === rRes) && (hAct === '*' || hAct === rAct);
}

interface ProtectedRouteProps {
    children: ReactNode;
    redirectTo?: string;
    requiredPermissions?: string[];
    requiredRoles?: string[];
    /** Require PLATFORM administrator (system-scoped). Gates the control-plane admin pages. */
    requirePlatformAdmin?: boolean;
    fallback?: ReactNode;
}

/**
 * Client-side access guard for route UX. Worker endpoints remain the security boundary.
 *
 * The app-root AuthSessionBootstrap fetches the authoritative session once. This guard
 * only consumes that result, so navigating between protected routes never refetches it.
 */
export function ProtectedRoute({
    children,
    redirectTo = '/login',
    requiredPermissions,
    requiredRoles,
    requirePlatformAdmin,
    fallback,
}: ProtectedRouteProps) {
    const navigate = useNavigate();
    const { isAuthenticated, isInitialized, user } = useSession();
    const hasRedirected = useRef(false);

    useEffect(() => {
        if (hasRedirected.current || !isInitialized || isAuthenticated) return;

        hasRedirected.current = true;
        rememberReturnPath();
        navigate({ to: redirectTo, replace: true });
    }, [isAuthenticated, isInitialized, navigate, redirectTo]);

    // Waiting for the root bootstrap prevents a cookie-only first visit from redirecting
    // before the backend has confirmed its session.
    if (!isInitialized) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="text-center space-y-4">
                    <Spinner className="h-8 w-8 mx-auto" />
                    <p className="text-sm text-muted-foreground">Checking authentication...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) return null; // Redirect runs in the effect above.

    const hasRequiredRoles =
        !requiredRoles || requiredRoles.length === 0 || requiredRoles.some((role) => user?.roles?.includes(role));

    const hasRequiredPermissions =
        !requiredPermissions ||
        requiredPermissions.length === 0 ||
        requiredPermissions.every((perm) => user?.permissions?.some((held) => matchesPermission(held, perm)));

    const authorized = hasRequiredRoles && hasRequiredPermissions && (!requirePlatformAdmin || isPlatformAdmin(user));

    if (!authorized) {
        if (fallback) return <>{fallback}</>;
        return (
            <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
                Access denied
            </div>
        );
    }

    return <>{children}</>;
}
