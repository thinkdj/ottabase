import React, { useState } from 'react';
import {
    Alert,
    AlertDescription,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@ottabase/ui-shadcn';
import { SocialLoginButtons, SocialLoginDivider, type SocialProvider } from './SocialLoginButtons';
import { CredentialsForm } from './CredentialsForm';
import { MagicLinkForm } from './MagicLinkForm';

export interface LoginFormProps {
    /** Card heading; pass '' (with description '') when the page already has its own heading */
    title?: string;
    description?: string;

    // Provider configurations
    socialProviders?: SocialProvider[];
    showCredentials?: boolean;
    showMagicLink?: boolean;

    // Default tab
    defaultTab?: 'credentials' | 'magic-link';

    // Callbacks
    onSocialLogin?: (providerId: string) => void;
    onCredentialsLogin?: (credentials: { email: string; password: string; rememberMe: boolean }) => Promise<void>;
    onMagicLinkSend?: (email: string) => Promise<void>;
    /** "Try again" after a magic link was sent; clear `magicLinkSuccess` here */
    onMagicLinkReset?: () => void;
    /** Receives the email typed so far, so a reset form can start prefilled */
    onForgotPassword?: (email: string) => void;

    // State
    isLoading?: boolean;
    error?: string;
    magicLinkSuccess?: boolean;

    // Customization
    className?: string;
    showSignUp?: boolean;
    onSignUpClick?: () => void;
    showRememberMe?: boolean;
    rememberMeLabel?: string;
    defaultRememberMe?: boolean;
}

/**
 * Email-first sign-in card: social buttons, then one email shared by the
 * password and email-link methods (switching tabs keeps what was typed).
 */
export function LoginForm({
    title = 'Welcome back',
    description = 'Sign in to your account',
    socialProviders = [],
    showCredentials = true,
    showMagicLink = false,
    defaultTab = 'credentials',
    onSocialLogin,
    onCredentialsLogin,
    onMagicLinkSend,
    onMagicLinkReset,
    onForgotPassword,
    isLoading = false,
    error,
    magicLinkSuccess = false,
    className = '',
    showSignUp = false,
    onSignUpClick,
    showRememberMe = true,
    rememberMeLabel = 'Remember me',
    defaultRememberMe = true,
}: LoginFormProps) {
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [email, setEmail] = useState('');

    const credentials = showCredentials && onCredentialsLogin && (
        <CredentialsForm
            onSubmit={onCredentialsLogin}
            isLoading={isLoading}
            email={email}
            onEmailChange={setEmail}
            showForgotPassword={!!onForgotPassword}
            onForgotPassword={onForgotPassword}
            showRememberMe={showRememberMe}
            rememberMeLabel={rememberMeLabel}
            defaultRememberMe={defaultRememberMe}
        />
    );
    const magicLink = showMagicLink && onMagicLinkSend && (
        <MagicLinkForm
            onSubmit={onMagicLinkSend}
            isLoading={isLoading}
            success={magicLinkSuccess}
            email={email}
            onEmailChange={setEmail}
            onReset={onMagicLinkReset}
        />
    );
    const hasSocial = socialProviders.length > 0;

    return (
        <Card className={`w-full max-w-md ${className}`}>
            {(title || description) && (
                <CardHeader>
                    {title && <CardTitle>{title}</CardTitle>}
                    {description && <CardDescription>{description}</CardDescription>}
                </CardHeader>
            )}
            <CardContent className={`space-y-6 ${title || description ? '' : 'pt-6'}`}>
                {/* One place for every sign-in error, social ones included */}
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {hasSocial && onSocialLogin && (
                    <>
                        <SocialLoginButtons
                            providers={socialProviders}
                            onProviderClick={onSocialLogin}
                            isLoading={isLoading}
                        />
                        {(credentials || magicLink) && <SocialLoginDivider text="or" />}
                    </>
                )}

                {credentials && magicLink ? (
                    <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as typeof defaultTab)}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="credentials">Password</TabsTrigger>
                            <TabsTrigger value="magic-link">Email link</TabsTrigger>
                        </TabsList>
                        <TabsContent value="credentials">{credentials}</TabsContent>
                        <TabsContent value="magic-link">{magicLink}</TabsContent>
                    </Tabs>
                ) : (
                    credentials || magicLink
                )}

                {showSignUp && onSignUpClick && (
                    <div className="text-center text-sm">
                        Don't have an account?{' '}
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
