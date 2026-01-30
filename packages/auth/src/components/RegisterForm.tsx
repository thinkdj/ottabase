import React, { useState } from 'react';
import { Button, Input, Label, Alert, AlertDescription, Spinner } from '@ottabase/ui-shadcn';
import { CheckCircle2 } from 'lucide-react';

export interface RegisterFormData {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
}

export interface RegisterFormProps {
    onSubmit: (data: RegisterFormData) => Promise<void>;
    isLoading?: boolean;
    error?: string;
    success?: boolean;
    nameLabel?: string;
    emailLabel?: string;
    passwordLabel?: string;
    confirmPasswordLabel?: string;
    submitButtonText?: string;
    successMessage?: string;
    showTermsCheckbox?: boolean;
    termsText?: string;
    onTermsClick?: () => void;
    className?: string;
}

export function RegisterForm({
    onSubmit,
    isLoading = false,
    error,
    success = false,
    nameLabel = 'Full Name',
    emailLabel = 'Email',
    passwordLabel = 'Password',
    confirmPasswordLabel = 'Confirm Password',
    submitButtonText = 'Create Account',
    successMessage = 'Account created successfully!',
    showTermsCheckbox = false,
    termsText = 'I agree to the Terms of Service and Privacy Policy',
    onTermsClick,
    className = '',
}: RegisterFormProps) {
    const [formData, setFormData] = useState<RegisterFormData>({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        // Name validation
        if (!formData.name.trim()) {
            errors.name = 'Name is required';
        } else if (formData.name.trim().length < 2) {
            errors.name = 'Name must be at least 2 characters';
        }

        // Email validation
        if (!formData.email) {
            errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'Invalid email address';
        }

        // Password validation
        if (!formData.password) {
            errors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            errors.password = 'Password must be at least 8 characters';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(formData.password)) {
            errors.password = 'Password must contain uppercase, lowercase, number, and special character';
        }

        // Confirm password validation
        if (!formData.confirmPassword) {
            errors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
            errors.confirmPassword = 'Passwords do not match';
        }

        // Terms acceptance
        if (showTermsCheckbox && !acceptedTerms) {
            errors.terms = 'You must accept the terms and conditions';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        await onSubmit(formData);
    };

    const handleChange = (field: keyof RegisterFormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        // Clear validation error for this field
        if (validationErrors[field]) {
            setValidationErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    if (success) {
        return (
            <div className={`space-y-4 ${className}`}>
                <Alert className="border-green-500">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
                </Alert>
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
                <Label htmlFor="name">{nameLabel}</Label>
                <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="name"
                />
                {validationErrors.name && <p className="text-xs text-destructive">{validationErrors.name}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">{emailLabel}</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="email"
                />
                {validationErrors.email && <p className="text-xs text-destructive">{validationErrors.email}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="password">{passwordLabel}</Label>
                <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="new-password"
                />
                {validationErrors.password && <p className="text-xs text-destructive">{validationErrors.password}</p>}
                <p className="text-xs text-muted-foreground">
                    At least 8 characters with uppercase, lowercase, and number
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="confirmPassword">{confirmPasswordLabel}</Label>
                <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="new-password"
                />
                {validationErrors.confirmPassword && (
                    <p className="text-xs text-destructive">{validationErrors.confirmPassword}</p>
                )}
            </div>

            {showTermsCheckbox && (
                <div className="flex items-start space-x-2">
                    <input
                        type="checkbox"
                        id="terms"
                        checked={acceptedTerms}
                        onChange={(e) => {
                            setAcceptedTerms(e.target.checked);
                            if (validationErrors.terms && e.target.checked) {
                                setValidationErrors((prev) => {
                                    const newErrors = { ...prev };
                                    delete newErrors.terms;
                                    return newErrors;
                                });
                            }
                        }}
                        disabled={isLoading}
                        className="mt-1"
                    />
                    <Label htmlFor="terms" className="text-sm font-normal cursor-pointer">
                        {onTermsClick ? (
                            <button type="button" onClick={onTermsClick} className="text-primary hover:underline">
                                {termsText}
                            </button>
                        ) : (
                            termsText
                        )}
                    </Label>
                </div>
            )}
            {validationErrors.terms && <p className="text-xs text-destructive">{validationErrors.terms}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Spinner className="mr-2 h-4 w-4" />}
                {submitButtonText}
            </Button>
        </form>
    );
}
