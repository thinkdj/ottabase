import React, { useState } from 'react';
import { Button, Input, Label, Alert, AlertDescription, Spinner } from '@ottabase/ui-shadcn';
import { Mail, CheckCircle2 } from 'lucide-react';

export interface MagicLinkFormProps {
    onSubmit: (email: string) => Promise<void>;
    isLoading?: boolean;
    error?: string;
    success?: boolean;
    emailLabel?: string;
    submitButtonText?: string;
    successMessage?: string;
    className?: string;
}

export function MagicLinkForm({
    onSubmit,
    isLoading = false,
    error,
    success = false,
    emailLabel = 'Email',
    submitButtonText = 'Send magic link',
    successMessage = 'Check your email for a login link!',
    className = '',
}: MagicLinkFormProps) {
    const [email, setEmail] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(email);
    };

    if (success) {
        return (
            <div className={`space-y-4 ${className}`}>
                <Alert className="border-green-500">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
                </Alert>
                <p className="text-sm text-muted-foreground text-center">
                    Didn't receive it?{' '}
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => window.location.reload()}
                        className="px-0"
                    >
                        Try again
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
                <Label htmlFor="email">{emailLabel}</Label>
                <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        required
                        autoComplete="email"
                        className="pl-10"
                    />
                </div>
                <p className="text-xs text-muted-foreground">We'll send you a login link</p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Spinner className="mr-2 h-4 w-4" />}
                {submitButtonText}
            </Button>
        </form>
    );
}
