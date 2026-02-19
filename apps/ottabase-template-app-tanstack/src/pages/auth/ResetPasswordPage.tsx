import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { resetPassword } from '@/lib/auth-api';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@ottabase/ui-shadcn';

export function ResetPasswordPage() {
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token') || '';
    const email = searchParams.get('email') || '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!token || !email) {
            setError('Invalid or missing reset token.');
            return;
        }

        if (!password || password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(password)) {
            setError('Password must contain uppercase, lowercase, number, and special character.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);
        try {
            const result = await resetPassword({ email, token, password });
            if (!result.success) {
                throw new Error(result.error || 'Password reset failed');
            }
            setSuccess(true);
            setTimeout(() => navigate({ to: '/login' }), 1200);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Password reset failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-[80vh] items-center justify-center">
            <div className="w-full max-w-md space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Reset your password</CardTitle>
                        <CardDescription>Choose a new password for your account</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {success ? (
                            <div className="space-y-2 text-sm">
                                <p className="font-medium text-green-600">Password updated successfully.</p>
                                <p className="text-muted-foreground">Redirecting to login...</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="password">New Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="new-password"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirm">Confirm Password</Label>
                                    <Input
                                        id="confirm"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        autoComplete="new-password"
                                    />
                                </div>
                                {error && <p className="text-sm text-destructive">{error}</p>}
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? 'Updating...' : 'Reset password'}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
