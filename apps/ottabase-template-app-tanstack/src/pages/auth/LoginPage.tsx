import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { LoginForm } from "@ottabase/auth/components";
import { useSession } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ottabase/ui-shadcn";

export function LoginPage() {
    const navigate = useNavigate();
    const { login } = useSession();
    const [error, setError] = useState<string>();
    const [isLoading, setIsLoading] = useState(false);
    const [magicLinkSent, setMagicLinkSent] = useState(false);

    // Auto-detect configured providers from env
    // For now, we'll use a simulated config
    const loginConfig = {
        socialProviders: [
            { id: "google", name: "Google" },
            { id: "github", name: "GitHub" },
        ],
        showCredentials: true,
        showMagicLink: false, // Set to true if email provider is configured
    };

    const handleSocialLogin = async (providerId: string) => {
        setIsLoading(true);
        setError(undefined);

        try {
            // TODO: Implement actual OAuth flow when Auth.js is setup
            // For now, simulate a login
            console.log(`Social login with ${providerId}`);

            // Simulated response
            setTimeout(() => {
                const mockSession = {
                    user: {
                        id: "1",
                        email: "user@example.com",
                        name: "Demo User",
                        image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${providerId}`,
                    },
                    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
                };

                login(mockSession);
                navigate({ to: "/dashboard" });
            }, 1000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
            setIsLoading(false);
        }
    };

    const handleCredentialsLogin = async ({
        email,
        password,
    }: {
        email: string;
        password: string;
    }) => {
        setIsLoading(true);
        setError(undefined);

        try {
            // TODO: Implement actual credentials auth when Auth.js is setup
            console.log(`Credentials login: ${email}`);

            // Simulated validation
            if (password.length < 6) {
                throw new Error("Password must be at least 6 characters");
            }

            // Simulated response
            setTimeout(() => {
                const mockSession = {
                    user: {
                        id: "1",
                        email,
                        name: email.split("@")[0],
                    },
                    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                };

                login(mockSession);
                navigate({ to: "/dashboard" });
            }, 1000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
            setIsLoading(false);
        }
    };

    const handleMagicLinkSend = async (email: string) => {
        setIsLoading(true);
        setError(undefined);

        try {
            // TODO: Implement actual magic link when Auth.js is setup
            console.log(`Magic link sent to: ${email}`);

            setTimeout(() => {
                setMagicLinkSent(true);
                setIsLoading(false);
            }, 1000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send magic link");
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-[80vh] items-center justify-center">
            <div className="w-full max-w-md space-y-4">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold">Welcome</h1>
                    <p className="text-muted-foreground">
                        Sign in to access your dashboard
                    </p>
                </div>

                <LoginForm
                    socialProviders={loginConfig.socialProviders}
                    showCredentials={loginConfig.showCredentials}
                    showMagicLink={loginConfig.showMagicLink}
                    onSocialLogin={handleSocialLogin}
                    onCredentialsLogin={handleCredentialsLogin}
                    onMagicLinkSend={handleMagicLinkSend}
                    isLoading={isLoading}
                    error={error}
                    magicLinkSuccess={magicLinkSent}
                    title="Sign in to your account"
                    description="Choose your preferred login method"
                    showSignUp
                    onSignUpClick={() => navigate({ to: "/register" })}
                />

                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-sm">
                            Don't have an account?{" "}
                            <Link to="/register" className="font-medium text-primary hover:underline">
                                Create one now
                            </Link>
                        </p>
                    </CardContent>
                </Card>

                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle className="text-sm">Demo Info</CardTitle>
                        <CardDescription className="text-xs">
                            This is a demo implementation with simulated auth
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs space-y-2">
                        <p>
                            <strong>Credentials:</strong> Use any email with password (6+ chars)
                        </p>
                        <p>
                            <strong>Social:</strong> Buttons are simulated for demo
                        </p>
                        <p className="text-muted-foreground">
                            Session persists in localStorage for 30 days
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
