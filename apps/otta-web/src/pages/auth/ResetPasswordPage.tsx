import { resetPassword } from '@/lib/auth-api';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '@ottabase/auth/config';
import { PasswordChecklist, PasswordInput } from '@ottabase/auth/components';
import { Button, Label } from '@ottabase/ui-shadcn';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { AuthCard, AuthShell } from './AuthShell';

export function ResetPasswordPage() {
    const navigate = useNavigate();
    const [{ token, email }] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return { token: params.get('token') || '', email: params.get('email') || '' };
    });

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!isStrongPassword(password)) {
            setError(PASSWORD_POLICY_MESSAGE);
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);
        try {
            const result = await resetPassword({ email, token, password });
            if (!result.success) throw new Error(result.error || 'Password reset failed');
            setSuccess(true);
            setTimeout(() => navigate({ to: '/login', search: { passwordChanged: '1' } }), 1200);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Password reset failed');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token || !email) {
        return (
            <AuthShell title="This link doesn't work" subtitle="The reset link is incomplete or was cut off">
                <AuthCard>
                    <p>Open the link from the email again, or ask for a new one from the sign-in page.</p>
                    <Button asChild>
                        <Link to="/login">Back to sign in</Link>
                    </Button>
                </AuthCard>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            title="Choose a new password"
            subtitle={
                <>
                    For <strong className="text-foreground">{email}</strong>
                </>
            }
        >
            <AuthCard>
                {success ? (
                    <p role="status" className="font-medium text-success">
                        Password updated. Taking you to sign in…
                    </p>
                ) : (
                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">New password</Label>
                            <PasswordInput
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                                disabled={isLoading}
                                aria-describedby="password-rules"
                            />
                            <PasswordChecklist id="password-rules" password={password} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm">Confirm password</Label>
                            <PasswordInput
                                id="confirm"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                                disabled={isLoading}
                            />
                        </div>
                        {error && (
                            <p role="alert" className="text-destructive">
                                {error}
                            </p>
                        )}
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Saving…' : 'Save new password'}
                        </Button>
                    </form>
                )}
            </AuthCard>
        </AuthShell>
    );
}
