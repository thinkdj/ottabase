import { useState, useEffect } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { RegisterForm, type RegisterFormData } from '@ottabase/auth/components';
import { useSession } from '@/lib/auth';
import { signInWithCredentials } from '@/lib/auth-api';
import { api, isApiError } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@ottabase/ui-shadcn';
import { ArrowLeft } from 'lucide-react';
import { getStoredReferralCode, getReferralExpiryInfo } from '@/lib/referrals';

export function RegisterPage() {
    const navigate = useNavigate();
    const { login } = useSession();
    const [error, setError] = useState<string>();
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [referralExpiry, setReferralExpiry] = useState<{ daysRemaining: number } | null>(null);

    // Check for stored referral code on mount
    useEffect(() => {
        const code = getStoredReferralCode();
        if (code) {
            setReferralCode(code);
            const expiry = getReferralExpiryInfo();
            setReferralExpiry({ daysRemaining: expiry.daysRemaining || 0 });
        }
    }, []);

    const handleRegister = async (data: RegisterFormData) => {
        setIsLoading(true);
        setError(undefined);

        try {
            const response = await api<{
                success: boolean;
                session?: {
                    user: {
                        id: string;
                        email: string;
                        name?: string | null;
                        image?: string | null;
                        emailVerified?: string | null;
                    };
                    expires: string;
                };
            }>('/api/auth/register', {
                method: 'POST',
                body: {
                    email: data.email,
                    password: data.password,
                    name: data.name,
                    referralCode: referralCode || undefined,
                },
            });

            if (!response.success || !response.session) {
                throw new Error('Registration failed');
            }

            const loginResult = await signInWithCredentials(
                { email: data.email, password: data.password },
                { redirect: false },
            );

            if (!loginResult.success) {
                throw new Error(loginResult.error || 'Registration completed, but sign-in failed');
            }

            if (loginResult.url) {
                window.location.href = loginResult.url;
                return;
            }

            login(loginResult.session || response.session);
            setSuccess(true);

            // Redirect to dashboard after a brief success message
            setTimeout(() => {
                navigate({ to: '/dashboard' });
            }, 1500);
        } catch (err) {
            const message = isApiError(err) ? err.message : err instanceof Error ? err.message : 'Registration failed';
            setError(message);
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-[80vh] items-center justify-center">
            <div className="w-full max-w-md space-y-4">
                <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm">
                        <Link to="/login" className="flex items-center gap-1">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Login
                        </Link>
                    </Button>
                </div>

                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold">Create Account</h1>
                    <p className="text-muted-foreground">Sign up to get started</p>
                    {referralCode && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm">
                            <p className="font-medium">
                                You were referred by: <strong>{referralCode}</strong>
                            </p>
                            {referralExpiry && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Referral expires in {referralExpiry.daysRemaining} days
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Registration</CardTitle>
                        <CardDescription>Fill in your details to create a new account</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RegisterForm
                            onSubmit={handleRegister}
                            isLoading={isLoading}
                            error={error}
                            success={success}
                            successMessage="Account created! Redirecting to dashboard..."
                            showTermsCheckbox
                            termsText="I agree to the Terms of Service and Privacy Policy"
                            onTermsClick={() => {
                                // TODO: Open terms modal or navigate to terms page
                                console.log('Show terms');
                            }}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-sm">
                            Already have an account?{' '}
                            <Link to="/login" className="font-medium text-primary hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </CardContent>
                </Card>

                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle className="text-sm">Demo Info</CardTitle>
                        <CardDescription className="text-xs">
                            Registration creates a real user via Auth.js + D1
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs space-y-2">
                        <p>
                            <strong>Password requirements:</strong> 8+ chars with uppercase, lowercase, and number
                        </p>
                        <p>
                            <strong>Registration:</strong> Creates account and logs you in automatically
                        </p>
                        <p className="text-muted-foreground">Email verification can be enabled via Auth.js providers</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
