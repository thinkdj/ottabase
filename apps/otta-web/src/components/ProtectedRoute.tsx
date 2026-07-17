import { useSession } from '@/lib/auth';
import { rememberReturnPath } from '@/lib/auth-redirect';
import { AUTH_STORAGE_KEY } from '@ottabase/auth/react';
import { Spinner } from '@ottabase/ui-shadcn';
import { useNavigate } from '@tanstack/react-router';
import { ReactNode, useEffect, useRef, useState } from 'react';

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
    fallback,
}: ProtectedRouteProps) {
    const navigate = useNavigate();
    const { isAuthenticated, isLoading, user, refreshSession } = useSession({ skipAutoSync: true });
    const hasRedirected = useRef(false);
    // Check storage on mount to prevent hydration flash
    const [initialCheck] = useState(hasValidStoredSession);

    // Authorization must be decided against FRESH session data, not the persisted localStorage
    // snapshot: roles/permissions can be stale in the atom (issued before an owner role was granted,
    // carried over from a prior login, or updated in another tab) while /api/auth/session is correct.
    // Without this an owner with `*:*` on the server can be wrongly denied. Pull the current session
    // once for role/permission-gated routes and hold the decision until it resolves.
    const gatesAuthz = (requiredPermissions?.length ?? 0) > 0 || (requiredRoles?.length ?? 0) > 0;
    const [authzResolved, setAuthzResolved] = useState(!gatesAuthz);
    const authzStarted = useRef(false);

    useEffect(() => {
        if (!gatesAuthz || authzStarted.current) return;
        authzStarted.current = true;
        let active = true;
        Promise.resolve(refreshSession()).finally(() => {
            if (active) setAuthzResolved(true);
        });
        return () => {
            active = false;
        };
    }, [gatesAuthz, refreshSession]);

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
        requiredPermissions.every((perm) => user?.permissions?.some((held) => matchesPermission(held, perm)));

    const authorized = hasRequiredRoles && hasRequiredPermissions;

    // Don't flash "denied" while the fresh authz fetch is still in flight — the stored session
    // may simply be stale. Wait for the refresh, then decide.
    if (gatesAuthz && !authzResolved && !authorized) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="text-center space-y-4">
                    <Spinner className="h-8 w-8 mx-auto" />
                    <p className="text-sm text-muted-foreground">Checking permissions...</p>
                </div>
            </div>
        );
    }

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
