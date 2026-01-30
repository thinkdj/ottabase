import React, { useState } from 'react';
import { Button, Input, Label, Alert, AlertDescription, Spinner } from '@ottabase/ui-shadcn';

export interface CredentialsFormProps {
    onSubmit: (credentials: { email: string; password: string }) => Promise<void>;
    isLoading?: boolean;
    error?: string;
    emailLabel?: string;
    passwordLabel?: string;
    submitButtonText?: string;
    showForgotPassword?: boolean;
    onForgotPassword?: () => void;
    className?: string;
}

export function CredentialsForm({
    onSubmit,
    isLoading = false,
    error,
    emailLabel = 'Email',
    passwordLabel = 'Password',
    submitButtonText = 'Sign in',
    showForgotPassword = false,
    onForgotPassword,
    className = '',
}: CredentialsFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit({ email, password });
    };

    return (
        <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="space-y-2">
                <Label htmlFor="email">{emailLabel}</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="email"
                />
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password">{passwordLabel}</Label>
                    {showForgotPassword && onForgotPassword && (
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={onForgotPassword}
                            className="px-0 font-normal"
                        >
                            Forgot password?
                        </Button>
                    )}
                </div>
                <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="current-password"
                />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Spinner className="mr-2 h-4 w-4" />}
                {submitButtonText}
            </Button>
        </form>
    );
}
