import { useSession } from '@/lib/auth';
import { getCsrfToken } from '@/lib/auth-api';
import { AUTH_STORAGE_KEY, clearAuthSessionStorage } from '@ottabase/auth/react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { IconKey, IconLogin, IconRefresh, IconShieldLock, IconTrash } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

const CURRENT_ORG_KEY = 'ottabase.current-org-id';

export function AuthDemoPage() {
    const { session, user, isAuthenticated, isLoading, refreshSession, logout } = useSession();
    const [storageSnapshot, setStorageSnapshot] = useState<Record<string, string | null>>({});
    const [csrfToken, setCsrfToken] = useState<string | null>(null);
    const [csrfLoading, setCsrfLoading] = useState(false);

    const authState = useMemo(() => {
        if (isLoading) return 'loading';
        return isAuthenticated ? 'authenticated' : 'anonymous';
    }, [isAuthenticated, isLoading]);

    const roles = (user?.roles as string[] | undefined) ?? [];
    const permissions = (user?.permissions as string[] | undefined) ?? [];
    const emailVerified = user?.emailVerified ? new Date(Number(user.emailVerified)).toLocaleString() : null;

    const readStorage = () => {
        try {
            setStorageSnapshot({
                [AUTH_STORAGE_KEY]: localStorage.getItem(AUTH_STORAGE_KEY),
                [CURRENT_ORG_KEY]: localStorage.getItem(CURRENT_ORG_KEY),
            });
        } catch {
            setStorageSnapshot({ [AUTH_STORAGE_KEY]: 'unavailable', [CURRENT_ORG_KEY]: 'unavailable' });
        }
    };

    const clearStorageKeys = () => {
        try {
            clearAuthSessionStorage();
            localStorage.removeItem(CURRENT_ORG_KEY);
        } catch {
            // Ignore storage failures in demo mode
        }
        readStorage();
    };

    const fetchCsrf = async () => {
        setCsrfLoading(true);
        try {
            setCsrfToken(await getCsrfToken());
        } finally {
            setCsrfLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Auth"
                description={
                    <>
                        Session, authorization snapshot, and CSRF helpers from <code>@ottabase/auth</code>. Sessions are
                        cookie-backed (HttpOnly) with server-side revocation; roles &amp; permissions come from the
                        server-side session snapshot, not the cookie. Safe for anonymous users.
                    </>
                }
            />

            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <IconKey className="h-4 w-4" />
                        Session Status
                    </CardTitle>
                    <CardDescription>Current session state from the shared auth hook.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge
                            variant={authState === 'authenticated' ? 'default' : 'outline'}
                            className={
                                authState === 'authenticated'
                                    ? 'rounded-full'
                                    : 'rounded-full border-transparent bg-background text-muted-foreground ring-1 ring-border'
                            }
                        >
                            {authState}
                        </Badge>
                        {user?.email && (
                            <Badge
                                variant="outline"
                                className="rounded-full border-transparent bg-background text-muted-foreground ring-1 ring-border"
                            >
                                {user.email}
                            </Badge>
                        )}
                        <Badge
                            variant={emailVerified ? 'default' : 'outline'}
                            className={
                                emailVerified
                                    ? 'rounded-full'
                                    : 'rounded-full border-transparent bg-background text-muted-foreground ring-1 ring-border'
                            }
                        >
                            {emailVerified ? `email verified` : 'email unverified'}
                        </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => refreshSession()} variant="outline">
                            <IconRefresh className="mr-2 h-4 w-4" />
                            Refresh session
                        </Button>
                        <Button onClick={readStorage} variant="outline">
                            Read storage keys
                        </Button>
                        <Button onClick={clearStorageKeys} variant="outline">
                            <IconTrash className="mr-2 h-4 w-4" />
                            Clear session keys
                        </Button>
                        {isAuthenticated && (
                            <Button onClick={() => logout()} variant="destructive">
                                Log out
                            </Button>
                        )}
                    </div>
                    {Object.keys(storageSnapshot).length > 0 && (
                        <pre className="max-h-56 overflow-auto rounded-lg bg-background p-3 text-xs ring-1 ring-border">
                            {JSON.stringify(storageSnapshot, null, 2)}
                        </pre>
                    )}
                    <pre className="max-h-72 overflow-auto rounded-lg bg-background p-3 text-xs ring-1 ring-border">
                        {JSON.stringify(session, null, 2)}
                    </pre>
                </CardContent>
            </Card>

            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <IconShieldLock className="h-4 w-4" />
                        Authorization Snapshot
                    </CardTitle>
                    <CardDescription>
                        Roles, permissions, and active organization resolved for this session (served from the
                        server-side KV snapshot, so they can be revoked without waiting for the cookie to expire).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <div className="space-y-1.5">
                        <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Active organization
                        </div>
                        <Badge
                            variant="outline"
                            className="rounded-full border-transparent bg-background text-muted-foreground ring-1 ring-border"
                        >
                            {user?.organizationId ?? 'none'}
                        </Badge>
                    </div>
                    <div className="space-y-1.5">
                        <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Roles ({roles.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {roles.length ? (
                                roles.map((r) => (
                                    <Badge
                                        key={r}
                                        variant="outline"
                                        className="rounded-full border-transparent bg-background text-muted-foreground ring-1 ring-border"
                                    >
                                        {r}
                                    </Badge>
                                ))
                            ) : (
                                <span className="text-muted-foreground">none</span>
                            )}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Permissions ({permissions.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {permissions.length ? (
                                permissions.map((p) => (
                                    <Badge
                                        key={p}
                                        variant="outline"
                                        className="rounded-full border-transparent bg-background font-mono text-muted-foreground ring-1 ring-border"
                                    >
                                        {p}
                                    </Badge>
                                ))
                            ) : (
                                <span className="text-muted-foreground">none</span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">CSRF Token</CardTitle>
                    <CardDescription>
                        <code>GET /api/auth/csrf</code> sets a paired HttpOnly cookie and returns the plain token that
                        state-changing requests must echo back. The client API fetches this automatically for you.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Button onClick={fetchCsrf} variant="outline" disabled={csrfLoading}>
                        {csrfLoading ? 'Fetching…' : 'Fetch CSRF token'}
                    </Button>
                    {csrfToken && (
                        <pre className="overflow-auto break-all rounded-lg bg-background p-3 font-mono text-xs ring-1 ring-border">
                            {csrfToken}
                        </pre>
                    )}
                </CardContent>
            </Card>

            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Auth Flows</CardTitle>
                    <CardDescription>Use the app auth pages to test full sign-in behavior.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                        <Link to="/login">
                            <IconLogin className="mr-2 h-4 w-4" />
                            Open login
                        </Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link to="/register">Open register</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link to="/reset-password">Open reset password</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
