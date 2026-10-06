import { SEOHead } from '@/components/SEOHead';
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
import { Button } from '@ottabase/ui-shadcn';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { AuthCard, AuthShell } from './AuthShell';

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

    if (verificationRequired) {
        return (
            <AuthShell title="Check your email" subtitle="One more step before you can sign in">
                <AuthCard>
                    <p role="status">
                        {verificationSent ? 'We sent a verification link to ' : 'Verify '}
                        <strong>{registeredEmail}</strong>
                        {verificationSent ? '. Open it, then sign in.' : ' before signing in.'}
                    </p>
                    {verificationSent && (
                        <p className="text-muted-foreground">Nothing yet? Check spam, or send it again.</p>
                    )}
                    {error && (
                        <p role="alert" className="text-destructive">
                            {error}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={handleResendVerification} disabled={isLoading}>
                            {isLoading ? 'Sending…' : verificationSent ? 'Send again' : 'Send verification email'}
                        </Button>
                        <Button asChild variant="ghost">
                            <Link to="/login">Go to sign in</Link>
                        </Button>
                    </div>
                </AuthCard>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            title="Create account"
            subtitle={`Join ${APP_META.appName}`}
            footer={
                <>
                    Already have an account?{' '}
                    <Link to="/login" className="font-medium text-foreground hover:underline">
                        Sign in
                    </Link>
                </>
            }
        >
            <SEOHead title={`Create account · ${APP_META.appName}`} />
            {referralCode && (
                <div className="rounded-lg bg-background p-3 text-sm ring-1 ring-border">
                    <p className="font-medium">
                        Invited with code <strong>{referralCode}</strong>
                    </p>
                    {referralExpiry && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            The invite is valid for {referralExpiry.daysRemaining} more days
                        </p>
                    )}
                </div>
            )}

            <AuthCard>
                <RegisterForm
                    onSubmit={handleRegister}
                    isLoading={isLoading}
                    error={error}
                    success={success}
                    successMessage="Account created. Taking you in…"
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
            </AuthCard>
        </AuthShell>
    );
}
