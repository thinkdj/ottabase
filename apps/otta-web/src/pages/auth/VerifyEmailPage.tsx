import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { APP_META } from '@/ottabase/config';
import { verifyEmail } from '@/lib/auth-api';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';

export function VerifyEmailPage() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const run = async () => {
            const searchParams = new URLSearchParams(window.location.search);
            const token = searchParams.get('token') || '';
            const email = searchParams.get('email') || '';

            if (!token || !email) {
                setStatus('error');
                setError('Invalid verification link.');
                return;
            }

            const result = await verifyEmail(token, email);
            if (!result.success) {
                setStatus('error');
                setError(result.error || 'Email verification failed.');
                return;
            }

            setStatus('success');
            setTimeout(() => navigate({ to: '/login' }), 1200);
        };

        run().catch((err) => {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Email verification failed.');
        });
    }, [navigate]);

    return (
        <div className="flex min-h-[80vh] items-center justify-center">
            <div className="w-full max-w-md space-y-6">
                <div className="flex flex-col items-center gap-4 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-background text-lg font-bold text-foreground ring-1 ring-border">
                        {APP_META.appName.charAt(0)}
                    </span>
                    <div className="space-y-1.5">
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Email Verification</h1>
                        <p className="text-muted-foreground">Confirming your email address</p>
                    </div>
                </div>

                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="gap-1.5">
                        <CardTitle className="text-[0.9375rem] font-semibold">Verification status</CardTitle>
                        <CardDescription>We&apos;re confirming the link from your email</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        {status === 'loading' && (
                            <p className="text-muted-foreground" aria-busy="true">
                                Verifying your email...
                            </p>
                        )}
                        {status === 'success' && (
                            <>
                                <p className="font-medium text-success">Email verified successfully.</p>
                                <p className="text-muted-foreground">Redirecting to login...</p>
                            </>
                        )}
                        {status === 'error' && (
                            <>
                                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                                    <p className="font-medium">Verification failed</p>
                                    {error && <p className="mt-1 text-destructive/90">{error}</p>}
                                </div>
                                <Button type="button" variant="outline" onClick={() => navigate({ to: '/login' })}>
                                    Back to login
                                </Button>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
