import { SEOHead } from '@/components/SEOHead';
import { useSession } from '@/lib/auth';
import { requestPasswordReset, sendMagicLink, signInWithCredentials, signInWithProvider } from '@/lib/auth-api';
import { resolveAuthRedirect } from '@/lib/auth-redirect';
import { APP_META } from '@/ottabase/config';
import { getLoginConfig } from '@ottabase/auth/config';
import { LoginForm } from '@ottabase/auth/components';
import {
    Alert,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
} from '@ottabase/ui-shadcn';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AuthShell } from './AuthShell';

type LoginConfig = ReturnType<typeof getLoginConfig> & { authSecretConfigured: boolean };

// OAuth and magic-link failures come back as ?error=CODE
const ERROR_MESSAGES: Record<string, string> = {
    OAuthAccountNotLinked:
        'An account already exists for this email. Sign in with your original method, then link this provider from your profile.',
    OAuthCallback: 'We could not complete sign-in with that provider. Please try again.',
    OAuthSignin: 'That provider is not available right now. Please try another sign-in method.',
    Verification: 'Your sign-in link is invalid or has expired. Request a new one.',
    AccountProvisioning: 'Your account workspace could not be initialized. Please try signing in again.',
    SessionRequired: 'Sign in first, then connect that provider from your profile.',
};

/** Error and success notice carried in the URL by redirects back to this page */
function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('error');
    const notice =
        params.get('passwordChanged') === '1'
            ? 'Password changed. Sign in with your new password.'
            : params.get('verified') === '1'
              ? 'Email verified. You can sign in now.'
              : undefined;
    return { error: code ? (ERROR_MESSAGES[code] ?? 'Sign-in failed. Please try again.') : undefined, notice };
}

/** Setup gaps worth flagging to a developer (never shown in production) */
function getDevWarnings(config: LoginConfig): string[] {
    const warnings: string[] = [];
    if (!config.authSecretConfigured) warnings.push('AUTH_SECRET is not set, so a default (insecure) one is used.');
    if (!config.showCredentials && !config.showMagicLink && config.socialProviders.length === 0) {
        warnings.push('No sign-in method is enabled. Enable credentials, an OAuth provider or magic links.');
    }
    if (config.socialProviders.length === 0) {
        warnings.push('No OAuth providers. Set the Google, GitHub, Discord, etc. client env vars.');
    }
    if (!config.showMagicLink) {
        warnings.push(
            'Magic links are off. Set DEV_EMAIL_TRAP_ENABLED locally, or EMAIL_SERVER + EMAIL_FROM / EMAIL_RESEND_API_KEY.',
        );
    }
    if (!config.showCredentials) warnings.push('Password sign-in is off (AUTH_DISABLE_CREDENTIALS).');
    return warnings;
}

export function LoginPage() {
    const navigate = useNavigate();
    const { login, isAuthenticated, isInitialized, sessionError } = useSession();
    const [urlState] = useState(readUrlState);
    const [error, setError] = useState<string | undefined>(urlState.error);
    const [isLoading, setIsLoading] = useState(false);
    const [magicLinkSent, setMagicLinkSent] = useState(false);
    const [forgotOpen, setForgotOpen] = useState(false);
    // Bumped on each open so the dialog starts fresh with the email typed so far
    const [forgotSeed, setForgotSeed] = useState({ email: '', key: 0 });
    const [loginConfig, setLoginConfig] = useState<LoginConfig>(() => ({
        ...getLoginConfig({} as Parameters<typeof getLoginConfig>[0]),
        authSecretConfigured: false,
    }));
    const hasNavigated = useRef(false);
    const redirectTarget = useRef(resolveAuthRedirect());

    useEffect(() => {
        let mounted = true;
        fetch('/api/auth/config')
            .then((res) => (res.ok ? (res.json() as Promise<LoginConfig>) : null))
            .then((config) => {
                if (mounted && config) setLoginConfig(config);
            })
            .catch(() => {});
        return () => {
            mounted = false;
        };
    }, []);

    // Already signed in: go straight on
    useEffect(() => {
        if (hasNavigated.current || !isInitialized || sessionError || !isAuthenticated) return;
        hasNavigated.current = true;
        navigate({ to: redirectTarget.current, replace: true });
    }, [isAuthenticated, isInitialized, navigate, sessionError]);

    const devWarnings = useMemo(() => (import.meta.env.DEV ? getDevWarnings(loginConfig) : []), [loginConfig]);

    /**
     * Runs one sign-in attempt with shared loading and error handling. `run`
     * returns true when the page is about to leave, so buttons stay disabled.
     */
    const attempt = async (run: () => Promise<boolean | void>, fallback: string) => {
        setIsLoading(true);
        setError(undefined);
        try {
            if (await run()) return;
        } catch (err) {
            setError(err instanceof Error ? err.message : fallback);
        }
        setIsLoading(false);
    };

    const handleSocialLogin = (providerId: string) =>
        attempt(async () => {
            const result = await signInWithProvider(providerId, { redirectTo: redirectTarget.current });
            if (!result.success) throw new Error(result.error || 'Could not start sign-in with that provider');
            return true; // the browser is leaving for the provider
        }, 'Sign-in failed');

    const handleCredentialsLogin = ({
        email,
        password,
        rememberMe,
    }: {
        email: string;
        password: string;
        rememberMe: boolean;
    }) =>
        attempt(async () => {
            const result = await signInWithCredentials({ email, password }, { redirect: false });
            if (!result.success) throw new Error(result.error || 'Wrong email or password');
            if (result.session) login(result.session, { remember: rememberMe });
            hasNavigated.current = true;
            navigate({ to: redirectTarget.current, replace: true });
            return true;
        }, 'Sign-in failed');

    const handleMagicLinkSend = (email: string) =>
        attempt(async () => {
            const result = await sendMagicLink(email, { redirectTo: redirectTarget.current });
            if (!result.success) throw new Error(result.error || 'Could not send the sign-in link');
            setMagicLinkSent(true);
        }, 'Could not send the sign-in link');

    return (
        <AuthShell
            title="Sign in"
            subtitle={`Welcome back to ${APP_META.appName}`}
            notice={urlState.notice}
            footer={
                <>
                    New here?{' '}
                    <Link to="/register" className="font-medium text-foreground hover:underline">
                        Create account
                    </Link>
                </>
            }
        >
            <SEOHead title={`Sign in · ${APP_META.appName}`} />
            <LoginForm
                title=""
                description=""
                className="max-w-none"
                socialProviders={loginConfig.socialProviders}
                showCredentials={loginConfig.showCredentials}
                showMagicLink={loginConfig.showMagicLink}
                onSocialLogin={handleSocialLogin}
                onCredentialsLogin={handleCredentialsLogin}
                onMagicLinkSend={handleMagicLinkSend}
                onMagicLinkReset={() => {
                    setMagicLinkSent(false);
                    setError(undefined);
                }}
                onForgotPassword={(email) => {
                    setForgotSeed((seed) => ({ email, key: seed.key + 1 }));
                    setForgotOpen(true);
                }}
                isLoading={isLoading}
                error={error}
                magicLinkSuccess={magicLinkSent}
            />

            {devWarnings.length > 0 && (
                <Alert variant="warning" className="text-xs">
                    <details>
                        <summary className="cursor-pointer font-medium">
                            Auth setup notes ({devWarnings.length}, dev only)
                        </summary>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                            {devWarnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                            ))}
                        </ul>
                        <p className="mt-2 text-warning/80">Configure providers in wrangler.jsonc and .env files.</p>
                    </details>
                </Alert>
            )}

            <ForgotPasswordDialog
                key={forgotSeed.key}
                open={forgotOpen}
                onOpenChange={setForgotOpen}
                initialEmail={forgotSeed.email}
            />
        </AuthShell>
    );
}

function ForgotPasswordDialog({
    open,
    onOpenChange,
    initialEmail,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialEmail: string;
}) {
    const [email, setEmail] = useState(initialEmail);
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [error, setError] = useState<string | null>(null);
    const sending = status === 'sending';

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        const value = email.trim();
        if (!value) {
            setError('Enter the email you sign in with');
            return;
        }
        setStatus('sending');
        setError(null);
        try {
            const result = await requestPasswordReset(value);
            if (!result.success) throw new Error(result.error || 'Could not send the reset email');
            setStatus('sent');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send the reset email');
            setStatus('idle');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                {status === 'sent' ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Check your inbox</DialogTitle>
                            <DialogDescription>
                                If an account uses <strong className="text-foreground">{email.trim()}</strong>, a reset
                                link is on its way.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button type="button" onClick={() => onOpenChange(false)}>
                                Done
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <form onSubmit={submit} noValidate className="grid gap-4">
                        <DialogHeader>
                            <DialogTitle>Reset your password</DialogTitle>
                            <DialogDescription>We&apos;ll email you a link to choose a new one.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                            <Label htmlFor="forgot-email">Email</Label>
                            <Input
                                id="forgot-email"
                                type="email"
                                autoComplete="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={sending}
                                aria-invalid={error ? true : undefined}
                                aria-describedby={error ? 'forgot-error' : undefined}
                            />
                            {error && (
                                <p id="forgot-error" role="alert" className="text-sm text-destructive">
                                    {error}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={sending}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={sending}>
                                {sending ? 'Sending…' : 'Send reset link'}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
