import { useSession } from '@/lib/auth';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@ottabase/ui-shadcn';
import { useNavigate } from '@tanstack/react-router';
import { Calendar, LogOut, Mail } from 'lucide-react';
import { useEffect } from 'react';

export function DashboardPage() {
    const navigate = useNavigate();
    const { user, logout, session } = useSession();

    const handleLogout = () => {
        logout();
        navigate({ to: '/' });
    };

    useEffect(() => {
        if (!user) {
            // This shouldn't happen if route protection is working
            navigate({ to: '/login' });
        }
    }, [navigate, user]);

    if (!user) return null;

    const expiresAt = session ? new Date(session.expires) : null;
    const emailInitial = user.email?.[0]?.toUpperCase();
    const initials = user.name
        ? user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
        : emailInitial || '?';

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back, {user.name || user.email}!</p>
                </div>
                <Button variant="outline" onClick={handleLogout} className="shrink-0">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="gap-1.5">
                        <CardTitle className="text-[0.9375rem] font-semibold">Profile Information</CardTitle>
                        <CardDescription>Your authentication details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-20 w-20 ring-1 ring-border">
                                {user.image && <AvatarImage src={user.image} alt={user.name || user.email} />}
                                <AvatarFallback className="bg-background text-lg">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                                <p className="text-lg font-semibold">{user.name || 'User'}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Mail className="h-4 w-4" />
                                    {user.email}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 border-t border-border/60 pt-4">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                    User ID
                                </span>
                                <span className="rounded-full bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
                                    {user.id}
                                </span>
                            </div>

                            {user.roles && user.roles.length > 0 && (
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Roles
                                    </span>
                                    <span className="rounded-full bg-background px-2.5 py-0.5 text-xs font-medium text-foreground ring-1 ring-border">
                                        {user.roles.join(', ')}
                                    </span>
                                </div>
                            )}

                            {expiresAt && (
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Session Expires
                                    </span>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Calendar className="h-3 w-3" />
                                        {expiresAt.toLocaleDateString()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="gap-1.5">
                        <CardTitle className="text-[0.9375rem] font-semibold">Protected Content</CardTitle>
                        <CardDescription>This content is only visible to authenticated users</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                            <h3 className="mb-2 font-medium">🎉 You're Logged In!</h3>
                            <p className="text-sm text-muted-foreground">
                                This dashboard is a protected route. Users must be authenticated to view this content.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                Features
                            </h3>
                            <ul className="ml-4 space-y-1 text-sm text-muted-foreground">
                                <li>✓ Persistent authentication (localStorage)</li>
                                <li>✓ Session expiration (30 days)</li>
                                <li>✓ Protected routes</li>
                                <li>✓ Social & credentials login</li>
                                <li>✓ User profile management</li>
                            </ul>
                        </div>

                        <div className="border-t border-border/60 pt-4">
                            <p className="text-xs text-muted-foreground">
                                <strong className="font-medium text-foreground">Note:</strong> Session data is signed
                                and stored in secure, HttpOnly cookies.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader className="gap-1.5">
                    <CardTitle className="text-[0.9375rem] font-semibold">Session Data</CardTitle>
                    <CardDescription>Debug information about your current session</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="overflow-auto rounded-lg bg-background p-4 text-xs ring-1 ring-border">
                        {JSON.stringify({ user, session }, null, 2)}
                    </pre>
                </CardContent>
            </Card>
        </div>
    );
}
