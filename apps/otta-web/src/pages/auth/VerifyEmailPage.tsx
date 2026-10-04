import { requestEmailVerification, verifyEmail } from '@/lib/auth-api';
import { Button, Input, Label } from '@ottabase/ui-shadcn';
import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthCard, AuthShell } from './AuthShell';

export function VerifyEmailPage() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    // Prefilled from the link so a failed check is one tap from a fresh email
    const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get('email') || '');
    const [resend, setResend] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [resendError, setResendError] = useState<string | null>(null);

    useEffect(() => {
        const run = async () => {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token') || '';
            const linkEmail = params.get('email') || '';
            if (!token || !linkEmail) {
                setStatus('error');
                setError('This verification link is incomplete.');
                return;
            }
            const result = await verifyEmail(token, linkEmail);
            if (!result.success) {
                setStatus('error');
                setError(result.error || 'This verification link is invalid or has expired.');
                return;
            }
            setStatus('success');
            setTimeout(() => navigate({ to: '/login', search: { verified: '1' } }), 1200);
        };
        run().catch((err) => {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Email verification failed.');
        });
    }, [navigate]);

    const sendAgain = async (e: FormEvent) => {
        e.preventDefault();
        const value = email.trim();
        if (!value) {
            setResendError('Enter the email you signed up with');
            return;
        }
        setResend('sending');
        setResendError(null);
        try {
            const result = await requestEmailVerification(value);
            if (!result.success) throw new Error(result.error || 'Could not send a new link');
            setResend('sent');
        } catch (err) {
            setResendError(err instanceof Error ? err.message : 'Could not send a new link');
            setResend('idle');
        }
    };

    if (status === 'error') {
        return (
            <AuthShell title="Link didn't work" subtitle={error ?? 'Email verification failed.'}>
                <AuthCard>
                    {resend === 'sent' ? (
                        <p role="status">
                            A new link is on its way to <strong>{email.trim()}</strong>. Open the newest email.
                        </p>
                    ) : (
                        <form onSubmit={sendAgain} noValidate className="space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="verify-email">Send a fresh link to</Label>
                                <Input
                                    id="verify-email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={resend === 'sending'}
                                    aria-invalid={resendError ? true : undefined}
                                    aria-describedby={resendError ? 'verify-error' : undefined}
                                />
                                {resendError && (
                                    <p id="verify-error" role="alert" className="text-destructive">
                                        {resendError}
                                    </p>
                                )}
                            </div>
                            <Button type="submit" className="w-full" disabled={resend === 'sending'}>
                                {resend === 'sending' ? 'Sending…' : 'Send a new link'}
                            </Button>
                        </form>
                    )}
                    <Button asChild variant="ghost" className="w-full">
                        <Link to="/login">Back to sign in</Link>
                    </Button>
                </AuthCard>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            title={status === 'success' ? 'Email verified' : 'Verifying your email'}
            subtitle={status === 'success' ? 'Taking you to sign in…' : 'This only takes a moment'}
        >
            <div role="status" className="flex justify-center text-muted-foreground">
                {status === 'success' ? (
                    <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
                ) : (
                    <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                )}
                <span className="sr-only">{status === 'success' ? 'Email verified' : 'Verifying your email'}</span>
            </div>
        </AuthShell>
    );
}
