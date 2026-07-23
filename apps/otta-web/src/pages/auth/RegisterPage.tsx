import { APP_META } from '@/ottabase/config';
import { useSession } from '@/lib/auth';
import { registerWithCredentials, requestEmailVerification, signInWithCredentials } from '@/lib/auth-api';
import { resolveAuthRedirect } from '@/lib/auth-redirect';
import {
    clearStoredReferralCode,
    extractUtmParams,
    getReferralExpiryInfo,
    getStoredReferralCode,
} from '@/lib/referrals';
import { RegisterForm, type RegisterFormData } from '@ottabase/auth/components';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function RegisterPage() {
    const navigate = useNavigate();
    const { login } = useSession();
    const [error, setError] = useState<string>();
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [referralExpiry, setReferralExpiry] = useState<{ daysRemaining: number } | null>(null);
    const [verificationRequired, setVerificationRequired] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
    const hasNavigated = useRef(false);
    const redirectTarget = useRef(resolveAuthRedirect());

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
            const utm = extractUtmParams();
            const registerResult = await registerWithCredentials({
                name: data.name,
                email: data.email,
                password: data.password,
                referralCode: referralCode || undefined,
                ...utm,
            });

            if (!registerResult.success) {
                throw new Error(registerResult.error || 'Registration failed');
            }

            if (registerResult.requiresEmailVerification) {
                setVerificationRequired(true);
                setVerificationSent(!!registerResult.verificationSent);
                setRegisteredEmail(data.email);
                clearStoredReferralCode();
                setSuccess(true);
                setIsLoading(false);
                return;
            }

            const signInResult = await signInWithCredentials(
                { email: data.email, password: data.password },
                { redirect: false },
            );

            if (!signInResult.success) {
                throw new Error(signInResult.error || 'Registration succeeded, but sign in failed');
            }

            if (signInResult.session) {
                login(signInResult.session);
            }

            clearStoredReferralCode();
            setSuccess(true);
            setIsLoading(false);

            // Redirect after brief delay to show success message
            setTimeout(() => {
                if (hasNavigated.current) return;
                hasNavigated.current = true;
                navigate({ to: redirectTarget.current, replace: true });
            }, 1000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
            setIsLoading(false);
        }
    };

    const handleResendVerification = async () => {
        if (!registeredEmail) return;
        setIsLoading(true);
        setError(undefined);
        try {
            const result = await requestEmailVerification(registeredEmail);
            if (!result.success) {
                throw new Error(result.error || 'Failed to resend verification email');
            }
            setVerificationSent(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to resend verification email');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-[80vh] items-center justify-center">
            <div className="w-full max-w-md space-y-6">
                <div className="flex items-center">
                    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                        <Link to="/login">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Login
                        </Link>
                    </Button>
                </div>

                <div className="flex flex-col items-center gap-4 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-background text-lg font-bold text-foreground ring-1 ring-border">
                        {APP_META.appName.charAt(0)}
                    </span>
                    <div className="space-y-1.5">
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Create Account</h1>
                        <p className="text-muted-foreground">Sign up to get started</p>
                    </div>
                    {referralCode && (
                        <div className="w-full rounded-lg bg-background p-3 text-left text-sm ring-1 ring-border">
                            <p className="font-medium">
                                You were referred by: <strong>{referralCode}</strong>
                            </p>
                            {referralExpiry && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Referral expires in {referralExpiry.daysRemaining} days
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="gap-1.5">
                        <CardTitle className="text-[0.9375rem] font-semibold">Registration</CardTitle>
                        <CardDescription>Fill in your details to create a new account</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {verificationRequired ? (
                            <div className="space-y-4 text-sm">
                                <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                                    <p className="font-medium">Check your email to verify your account</p>
                                    <p className="mt-1 text-muted-foreground">
                                        We sent a verification link to <strong>{registeredEmail}</strong>. You must
                                        verify your email before signing in.
                                    </p>
                                </div>
                                {error && (
                                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                                        {error}
                                    </div>
                                )}
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={handleResendVerification}
                                    disabled={isLoading}
                                >
                                    {verificationSent ? 'Resend verification email' : 'Send verification email'}
                                </Button>
                            </div>
                        ) : (
                            <RegisterForm
                                onSubmit={handleRegister}
                                isLoading={isLoading}
                                error={error}
                                success={success}
                                successMessage="Account created! Redirecting to dashboard..."
                                showTermsCheckbox
                                termsContent={
                                    <span>
                                        I agree to the{' '}
                                        <a
                                            href="/legal/terms"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline"
                                        >
                                            Terms of Service
                                        </a>{' '}
                                        and{' '}
                                        <a
                                            href="/legal/privacy"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline"
                                        >
                                            Privacy Policy
                                        </a>
                                    </span>
                                }
                            />
                        )}
                    </CardContent>
                </Card>

                <div className="rounded-xl bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Link to="/login" className="font-medium text-foreground hover:underline">
                        Sign in
                    </Link>
                </div>

                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="gap-1.5">
                        <CardTitle className="text-[0.9375rem] font-semibold">Security</CardTitle>
                        <CardDescription className="text-xs">Your credentials are stored securely</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                        <p>
                            <strong className="font-medium text-foreground">Password requirements:</strong> 8+ chars
                            with uppercase, lowercase, number, and symbol
                        </p>
                        <p>
                            <strong className="font-medium text-foreground">Registration:</strong> Creates your account
                            and signs you in automatically
                        </p>
                        <p>Email verification can be enabled via worker configuration</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
