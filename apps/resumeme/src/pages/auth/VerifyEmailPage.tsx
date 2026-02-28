import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
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
            <div className="w-full max-w-md">
                <Card>
                    <CardHeader>
                        <CardTitle>Email Verification</CardTitle>
                        <CardDescription>Confirming your email address</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        {status === 'loading' && <p>Verifying your email...</p>}
                        {status === 'success' && (
                            <>
                                <p className="text-green-600 font-medium">Email verified successfully.</p>
                                <p className="text-muted-foreground">Redirecting to login...</p>
                            </>
                        )}
                        {status === 'error' && (
                            <>
                                <p className="text-destructive font-medium">Verification failed</p>
                                <p className="text-muted-foreground">{error}</p>
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
