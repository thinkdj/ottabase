import React, { useId, useState } from 'react';
import { Button, Input, Label, Alert, AlertDescription, Spinner } from '@ottabase/ui-shadcn';
import { Mail, MailCheck } from 'lucide-react';

export interface MagicLinkFormProps {
    onSubmit: (email: string) => Promise<void>;
    isLoading?: boolean;
    error?: string;
    success?: boolean;
    /** Controlled email (LoginForm shares one email across sign-in methods) */
    email?: string;
    onEmailChange?: (email: string) => void;
    /** "Try again" after a send; clear `success` here. Without it the page reloads. */
    onReset?: () => void;
    emailLabel?: string;
    submitButtonText?: string;
    /** Replaces the default "We sent a sign-in link to ..." line */
    successMessage?: string;
    className?: string;
}

export function MagicLinkForm({
    onSubmit,
    isLoading = false,
    error,
    success = false,
    email: controlledEmail,
    onEmailChange,
    onReset,
    emailLabel = 'Email',
    submitButtonText = 'Email me a sign-in link',
    successMessage,
    className = '',
}: MagicLinkFormProps) {
    const id = useId();
    const [ownEmail, setOwnEmail] = useState('');
    const email = controlledEmail ?? ownEmail;
    const setEmail = onEmailChange ?? setOwnEmail;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(email.trim());
    };

    if (success) {
        return (
            <div className={`space-y-3 ${className}`}>
                <Alert variant="success">
                    <p className="flex items-center gap-2 font-medium text-success">
                        <MailCheck className="h-4 w-4" aria-hidden="true" />
                        Check your inbox
                    </p>
                    <p className="mt-1 text-muted-foreground">
                        {successMessage ?? (
                            <>
                                We sent a sign-in link to <strong className="text-foreground">{email.trim()}</strong>.
                                Open it to finish signing in.
                            </>
                        )}
                    </p>
                </Alert>
                <p className="text-center text-sm text-muted-foreground">
                    Nothing yet? Check spam, or{' '}
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={onReset ?? (() => window.location.reload())}
                        className="h-auto px-0"
                    >
                        try again
                    </Button>
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="space-y-2">
                <Label htmlFor={`${id}-email`}>{emailLabel}</Label>
                <div className="relative">
                    <Mail
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <Input
                        id={`${id}-email`}
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        required
                        autoComplete="email"
                        aria-describedby={`${id}-hint`}
                        className="pl-10"
                    />
                </div>
                <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                    No password needed. We email you a link that signs you in.
                </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Spinner className="mr-2 h-4 w-4" />}
                {submitButtonText}
            </Button>
        </form>
    );
}
