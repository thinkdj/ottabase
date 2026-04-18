import { useSession } from '@/lib/auth';
import { requestPasswordReset, sendMagicLink, signInWithCredentials, signInWithProvider } from '@/lib/auth-api';
import { resolveAuthRedirect } from '@/lib/auth-redirect';
import { getLoginConfig, LoginForm } from '@ottabase/auth/components';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
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
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function LoginPage() {
    const navigate = useNavigate();
    const { login, isAuthenticated, isLoading: isSessionLoading } = useSession({ skipAutoSync: true });
    const [error, setError] = useState<string>();
    const [isLoading, setIsLoading] = useState(false);
    const [magicLinkSent, setMagicLinkSent] = useState(false);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [forgotOpen, setForgotOpen] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotStatus, setForgotStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [forgotError, setForgotError] = useState<string | null>(null);
    const hasNavigated = useRef(false);
    const redirectTarget = useRef(resolveAuthRedirect());

    // Auto-detect configured providers from env
    // This will check process.env for OAuth provider credentials
    const [loginConfig, setLoginConfig] = useState(
        () =>
            ({
                ...getLoginConfig({} as any),
                authSecretConfigured: false,
            }) as ReturnType<typeof getLoginConfig> & { authSecretConfigured: boolean },
    );
    const passwordChanged = new URLSearchParams(window.location.search).get('passwordChanged') === '1';

    useEffect(() => {
        let mounted = true;

        const loadConfig = async () => {
            try {
                const response = await fetch('/api/auth/config');
                if (!response.ok) return;
                const config = (await response.json()) as ReturnType<typeof getLoginConfig> & {
                    authSecretConfigured: boolean;
                };
                if (mounted) setLoginConfig(config);
            } catch {
                // ignore
            }
        };

        loadConfig();
        return () => {
            mounted = false;
        };
    }, []);

    // Redirect if already authenticated
    useEffect(() => {
        if (hasNavigated.current || isSessionLoading || !isAuthenticated) return;

        hasNavigated.current = true;
        navigate({ to: redirectTarget.current, replace: true });
    }, [isAuthenticated, isSessionLoading, navigate]);

    // Check for missing configuration and show warnings
    useEffect(() => {
        const newWarnings: string[] = [];

        // Check for AUTH_SECRET
        if (!loginConfig.authSecretConfigured) {
            newWarnings.push('AUTH_SECRET not configured - using default (insecure for production)');
        }

        // Check for any configured auth methods
        const hasAnySocialLogin = loginConfig.socialProviders.length > 0;
        const hasMagicLink = loginConfig.showMagicLink;
        const hasCredentials = loginConfig.showCredentials;

        if (!hasAnySocialLogin && !hasMagicLink && !hasCredentials) {
            newWarnings.push('No authentication methods configured. Enable credentials, OAuth, or Magic Link.');
        } else if (!hasAnySocialLogin && !hasMagicLink) {
            newWarnings.push('No OAuth providers or Magic Link configured. Only credentials login available.');
        }

        if (!hasAnySocialLogin) {
            newWarnings.push(
                'No OAuth providers configured. Set environment variables for Google, GitHub, Discord, etc.',
            );
        }

        if (!hasMagicLink) {
            newWarnings.push(
                'Magic Link not configured. Set DEV_EMAIL_TRAP_ENABLED for local capture, or configure EMAIL_SERVER + EMAIL_FROM / EMAIL_RESEND_API_KEY in the worker environment.',
            );
        }

        if (!hasCredentials) {
            newWarnings.push('Credentials login disabled. Set AUTH_DISABLE_CREDENTIALS=false to enable.');
        }

        setWarnings(newWarnings);
    }, [loginConfig]);

    const handleSocialLogin = async (providerId: string) => {
        setIsLoading(true);
        setError(undefined);

        try {
            const result = await signInWithProvider(providerId, {
                redirectTo: redirectTarget.current,
            });

            if (!result.success) {
                setError(result.error || 'Failed to sign in with provider');
                setIsLoading(false);
            }
            // If successful, the page will redirect automatically
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
            setIsLoading(false);
        }
    };

    const handleCredentialsLogin = async ({
        email,
        password,
        rememberMe,
    }: {
        email: string;
        password: string;
        rememberMe: boolean;
    }) => {
        setIsLoading(true);
        setError(undefined);

        try {
            const result = await signInWithCredentials({ email, password }, { redirect: false });

            if (!result.success) {
                setError(result.error || 'Invalid credentials');
                setIsLoading(false);
                return;
            }

            if (result.session) {
                login(result.session, { remember: rememberMe });
            }

            setIsLoading(false);
            hasNavigated.current = true;
            navigate({ to: redirectTarget.current, replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
            setIsLoading(false);
        }
    };

    const handleMagicLinkSend = async (email: string) => {
        setIsLoading(true);
        setError(undefined);

        try {
            const result = await sendMagicLink(email, {
                redirectTo: redirectTarget.current,
            });

            if (!result.success) {
                setError(result.error || 'Failed to send magic link');
                setIsLoading(false);
                return;
            }

            setMagicLinkSent(true);
            setIsLoading(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send magic link');
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!forgotEmail.trim()) {
            setForgotError('Please enter your email address');
            return;
        }

        setForgotStatus('sending');
        setForgotError(null);

        try {
            const result = await requestPasswordReset(forgotEmail.trim());
            if (!result.success) {
                throw new Error(result.error || 'Failed to send reset email');
            }
            setForgotStatus('sent');
        } catch (err) {
            setForgotError(err instanceof Error ? err.message : 'Failed to send reset email');
            setForgotStatus('idle');
        }
    };

    return (
        <div className="flex min-h-[80vh] items-center justify-center">
            <div className="w-full max-w-md space-y-4">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold">Welcome</h1>
                    <p className="text-muted-foreground">Sign in to access your dashboard</p>
                </div>

                {passwordChanged && (
                    <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
                        <CardContent className="p-6 text-sm text-green-700 dark:text-green-400">
                            Password changed successfully. Please sign in with your new password.
                        </CardContent>
                    </Card>
                )}

                {/* Configuration Warnings */}
                {warnings.length > 0 && (
                    <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                                <AlertCircle className="h-4 w-4" />
                                Configuration Warnings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs space-y-1">
                            {warnings.map((warning, index) => (
                                <p key={index} className="text-yellow-600 dark:text-yellow-500">
                                    • {warning}
                                </p>
                            ))}
                            <p className="text-muted-foreground mt-2 pt-2 border-t border-yellow-200 dark:border-yellow-800">
                                See wrangler.jsonc and .env files to configure auth providers
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Login Form */}
                <LoginForm
                    socialProviders={loginConfig.socialProviders}
                    showCredentials={loginConfig.showCredentials}
                    showMagicLink={loginConfig.showMagicLink}
                    onSocialLogin={handleSocialLogin}
                    onCredentialsLogin={handleCredentialsLogin}
                    onMagicLinkSend={handleMagicLinkSend}
                    onForgotPassword={() => {
                        setForgotEmail('');
                        setForgotStatus('idle');
                        setForgotError(null);
                        setForgotOpen(true);
                    }}
                    isLoading={isLoading}
                    error={error}
                    magicLinkSuccess={magicLinkSent}
                    title="Sign in to your account"
                    description="Choose your preferred login method"
                    showSignUp
                    onSignUpClick={() => navigate({ to: '/register' })}
                />

                {/* Sign Up Link */}
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-sm">
                            Don't have an account?{' '}
                            <Link to="/register" className="font-medium text-primary hover:underline">
                                Create one now
                            </Link>
                        </p>
                    </CardContent>
                </Card>

                {/* Production Info */}
                <Card className="mt-4 border-green-500/50 bg-green-50 dark:bg-green-950/20">
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4" />
                            Production-Ready Auth
                        </CardTitle>
                        <CardDescription className="text-xs">Powered by Auth.js with Cloudflare D1</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs space-y-2">
                        <p>
                            <strong>Credentials:</strong> Email/password authentication with secure hashing
                        </p>
                        <p>
                            <strong>Social Login:</strong> OAuth 2.0 providers (Google, GitHub, Discord, etc.)
                        </p>
                        <p>
                            <strong>Magic Link:</strong> Passwordless authentication via email
                        </p>
                        <p className="text-muted-foreground pt-2 border-t border-green-200 dark:border-green-800">
                            Sessions are JWT-based and stored in cookies for 30 days
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset your password</DialogTitle>
                        <DialogDescription>
                            Enter the email address associated with your account. We&apos;ll send you a password reset
                            link.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="forgot-email">Email</Label>
                        <Input
                            id="forgot-email"
                            type="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="you@example.com"
                        />
                        {forgotError && <p className="text-sm text-destructive">{forgotError}</p>}
                        {forgotStatus === 'sent' && (
                            <p className="text-sm text-green-600">Reset email sent. Check your inbox.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setForgotOpen(false)}
                            disabled={forgotStatus === 'sending'}
                        >
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleForgotPassword} disabled={forgotStatus === 'sending'}>
                            {forgotStatus === 'sending' ? 'Sending...' : 'Send reset link'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
