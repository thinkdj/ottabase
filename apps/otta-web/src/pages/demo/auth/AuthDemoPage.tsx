import { useSession } from '@/lib/auth';
import { AUTH_STORAGE_KEY, clearAuthSessionStorage } from '@ottabase/auth/react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { IconKey, IconLogin, IconRefresh, IconTrash } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

const CURRENT_ORG_KEY = 'ottabase.current-org-id';

export function AuthDemoPage() {
    const { session, user, isAuthenticated, isLoading, refreshSession, logout } = useSession();
    const [storageSnapshot, setStorageSnapshot] = useState<Record<string, string | null>>({});

    const authState = useMemo(() => {
        if (isLoading) return 'loading';
        return isAuthenticated ? 'authenticated' : 'anonymous';
    }, [isAuthenticated, isLoading]);

    const readStorage = () => {
        try {
            setStorageSnapshot({
                [AUTH_STORAGE_KEY]: localStorage.getItem(AUTH_STORAGE_KEY),
                [CURRENT_ORG_KEY]: localStorage.getItem(CURRENT_ORG_KEY),
            });
        } catch {
            setStorageSnapshot({
                [AUTH_STORAGE_KEY]: 'unavailable',
                [CURRENT_ORG_KEY]: 'unavailable',
            });
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

    return (
        <div className="space-y-6">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo">← Back to Demos</Link>
            </Button>

            <div className="space-y-2">
                <h1 className="text-3xl font-semibold">Auth Demo</h1>
                <p className="text-muted-foreground">
                    Session hook behavior and client storage helpers from <code>@ottabase/auth</code>. Safe for
                    anonymous users.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <IconKey className="h-5 w-5" />
                        Session Status
                    </CardTitle>
                    <CardDescription>Shows current session state from the shared auth hook.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant={authState === 'authenticated' ? 'default' : 'outline'}>{authState}</Badge>
                        {user?.email && <Badge variant="secondary">{user.email}</Badge>}
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
                        <pre className="max-h-56 overflow-auto rounded-lg bg-muted p-3 text-xs">
                            {JSON.stringify(storageSnapshot, null, 2)}
                        </pre>
                    )}
                    <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">
                        {JSON.stringify(session, null, 2)}
                    </pre>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Auth Flows</CardTitle>
                    <CardDescription>
                        Use existing app auth pages when you want to test full sign-in behavior.
                    </CardDescription>
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
