import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@ottabase/ui-shadcn";
import { SocialLoginButtons, SocialLoginDivider, type SocialProvider } from "./SocialLoginButtons";
import { CredentialsForm } from "./CredentialsForm";
import { MagicLinkForm } from "./MagicLinkForm";

export interface LoginFormProps {
    // Title and description
    title?: string;
    description?: string;

    // Provider configurations
    socialProviders?: SocialProvider[];
    showCredentials?: boolean;
    showMagicLink?: boolean;

    // Default tab
    defaultTab?: "credentials" | "magic-link";

    // Callbacks
    onSocialLogin?: (providerId: string) => void;
    onCredentialsLogin?: (credentials: { email: string; password: string }) => Promise<void>;
    onMagicLinkSend?: (email: string) => Promise<void>;
    onForgotPassword?: () => void;

    // State
    isLoading?: boolean;
    error?: string;
    magicLinkSuccess?: boolean;

    // Customization
    className?: string;
    showSignUp?: boolean;
    onSignUpClick?: () => void;
}

export function LoginForm({
    title = "Welcome back",
    description = "Sign in to your account",
    socialProviders = [],
    showCredentials = true,
    showMagicLink = false,
    defaultTab = "credentials",
    onSocialLogin,
    onCredentialsLogin,
    onMagicLinkSend,
    onForgotPassword,
    isLoading = false,
    error,
    magicLinkSuccess = false,
    className = "",
    showSignUp = false,
    onSignUpClick,
}: LoginFormProps) {
    const [activeTab, setActiveTab] = useState(defaultTab);

    const hasSocial = socialProviders.length > 0;
    const hasMultipleMethods = [showCredentials, showMagicLink].filter(Boolean).length > 1;

    return (
        <Card className={`w-full max-w-md ${className}`}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Social providers */}
                {hasSocial && onSocialLogin && (
                    <>
                        <SocialLoginButtons
                            providers={socialProviders}
                            onProviderClick={onSocialLogin}
                            isLoading={isLoading}
                        />
                        {(showCredentials || showMagicLink) && (
                            <SocialLoginDivider text="or" />
                        )}
                    </>
                )}

                {/* Credentials and Magic Link */}
                {(showCredentials || showMagicLink) && (
                    <>
                        {hasMultipleMethods ? (
                            <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as "credentials" | "magic-link")}>
                                <TabsList className="grid w-full grid-cols-2">
                                    {showCredentials && (
                                        <TabsTrigger value="credentials">Email & Password</TabsTrigger>
                                    )}
                                    {showMagicLink && (
                                        <TabsTrigger value="magic-link">Magic Link</TabsTrigger>
                                    )}
                                </TabsList>

                                {showCredentials && onCredentialsLogin && (
                                    <TabsContent value="credentials">
                                        <CredentialsForm
                                            onSubmit={onCredentialsLogin}
                                            isLoading={isLoading}
                                            error={error}
                                            showForgotPassword={!!onForgotPassword}
                                            onForgotPassword={onForgotPassword}
                                        />
                                    </TabsContent>
                                )}

                                {showMagicLink && onMagicLinkSend && (
                                    <TabsContent value="magic-link">
                                        <MagicLinkForm
                                            onSubmit={onMagicLinkSend}
                                            isLoading={isLoading}
                                            error={error}
                                            success={magicLinkSuccess}
                                        />
                                    </TabsContent>
                                )}
                            </Tabs>
                        ) : (
                            <>
                                {showCredentials && onCredentialsLogin && (
                                    <CredentialsForm
                                        onSubmit={onCredentialsLogin}
                                        isLoading={isLoading}
                                        error={error}
                                        showForgotPassword={!!onForgotPassword}
                                        onForgotPassword={onForgotPassword}
                                    />
                                )}

                                {showMagicLink && onMagicLinkSend && (
                                    <MagicLinkForm
                                        onSubmit={onMagicLinkSend}
                                        isLoading={isLoading}
                                        error={error}
                                        success={magicLinkSuccess}
                                    />
                                )}
                            </>
                        )}
                    </>
                )}

                {/* Sign up link */}
                {showSignUp && onSignUpClick && (
                    <div className="text-center text-sm">
                        Don't have an account?{" "}
                        <button
                            type="button"
                            onClick={onSignUpClick}
                            className="font-medium text-primary hover:underline"
                        >
                            Sign up
                        </button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
