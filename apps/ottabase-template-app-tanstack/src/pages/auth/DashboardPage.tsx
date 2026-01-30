import { useSession } from '@/lib/auth';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Badge,
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back, {user.name || user.email}!</p>
                </div>
                <Button variant="outline" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile Information</CardTitle>
                        <CardDescription>Your authentication details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-20 w-20">
                                {user.image && <AvatarImage src={user.image} alt={user.name || user.email} />}
                                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                                <p className="text-lg font-semibold">{user.name || 'User'}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Mail className="h-4 w-4" />
                                    {user.email}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">User ID</span>
                                <Badge variant="secondary">{user.id}</Badge>
                            </div>

                            {user.role && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Role</span>
                                    <Badge>{user.role}</Badge>
                                </div>
                            )}

                            {expiresAt && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Session Expires</span>
                                    <div className="flex items-center gap-1 text-xs">
                                        <Calendar className="h-3 w-3" />
                                        {expiresAt.toLocaleDateString()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Protected Content</CardTitle>
                        <CardDescription>This content is only visible to authenticated users</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <h3 className="font-medium mb-2">🎉 You're Logged In!</h3>
                            <p className="text-sm text-muted-foreground">
                                This dashboard is a protected route. Users must be authenticated to view this content.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h3 className="font-medium text-sm">Features:</h3>
                            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                                <li>✓ Persistent authentication (localStorage)</li>
                                <li>✓ Session expiration (30 days)</li>
                                <li>✓ Protected routes</li>
                                <li>✓ Social & credentials login</li>
                                <li>✓ User profile management</li>
                            </ul>
                        </div>

                        <div className="pt-4 border-t">
                            <p className="text-xs text-muted-foreground">
                                <strong>Note:</strong> This is a demo implementation. In production, you'd integrate
                                with Auth.js and a real backend.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Session Data</CardTitle>
                    <CardDescription>Debug information about your current session</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                        {JSON.stringify({ user, session }, null, 2)}
                    </pre>
                </CardContent>
            </Card>
        </div>
    );
}
