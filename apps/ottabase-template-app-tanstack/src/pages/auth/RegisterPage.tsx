import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { RegisterForm, type RegisterFormData } from "@ottabase/auth/components";
import { useSession } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@ottabase/ui-shadcn";
import { ArrowLeft } from "lucide-react";

export function RegisterPage() {
    const navigate = useNavigate();
    const { login } = useSession();
    const [error, setError] = useState<string>();
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleRegister = async (data: RegisterFormData) => {
        setIsLoading(true);
        setError(undefined);

        try {
            // TODO: Implement actual registration when Auth.js is setup
            console.log("Registering user:", data);

            // Simulated API call
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // Demo-only: simulated "email already exists" check.
            // This runs in development builds to mimic backend validation.
            // In production, real uniqueness checks must be performed on the server.
            if (import.meta.env?.DEV) {
                const simulatedExistingEmails = ["existing@example.com"];
                if (simulatedExistingEmails.includes(data.email)) {
                    throw new Error("An account with this email already exists");
                }
            }

            // Simulated successful registration
            const mockSession = {
                user: {
                    id: Math.random().toString(36).substring(7),
                    email: data.email,
                    name: data.name,
                },
                expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            };

            // Log them in immediately after registration
            login(mockSession);
            setSuccess(true);

            // Redirect to dashboard after a brief success message
            setTimeout(() => {
                navigate({ to: "/dashboard" });
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Registration failed");
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
                    <p className="text-muted-foreground">
                        Sign up to get started
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Registration</CardTitle>
                        <CardDescription>
                            Fill in your details to create a new account
                        </CardDescription>
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
                                console.log("Show terms");
                            }}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-sm">
                            Already have an account?{" "}
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
                            This is a demo implementation with simulated registration
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs space-y-2">
                        <p>
                            <strong>Password requirements:</strong> 8+ chars with uppercase,
                            lowercase, and number
                        </p>
                        <p>
                            <strong>Registration:</strong> Creates account and logs you in
                            automatically
                        </p>
                        <p className="text-muted-foreground">
                            In production, you'd send a verification email
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
