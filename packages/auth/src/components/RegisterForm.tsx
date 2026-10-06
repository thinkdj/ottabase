import React, { useId, useState } from 'react';
import { Alert, AlertDescription, Button, Checkbox, Input, Label, Spinner } from '@ottabase/ui-shadcn';
import { CheckCircle2 } from 'lucide-react';
import { isStrongPassword } from '../password';
import { PasswordChecklist, PasswordInput } from './PasswordFields';

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
    /** Override the entire label content with a custom React node (e.g. two separate links) */
    termsContent?: React.ReactNode;
    className?: string;
}

type FieldKey = keyof RegisterFormData | 'terms';

function validate(data: RegisterFormData, needTerms: boolean, acceptedTerms: boolean) {
    const errors: Partial<Record<FieldKey, string>> = {};
    const name = data.name.trim();
    if (!name) errors.name = 'Enter your name';
    else if (name.length < 2) errors.name = 'Name must be at least 2 characters';

    if (!data.email) errors.email = 'Enter your email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) errors.email = 'That email looks incomplete';

    if (!data.password) errors.password = 'Choose a password';
    else if (!isStrongPassword(data.password)) errors.password = 'Tick off every item above';

    if (!data.confirmPassword) errors.confirmPassword = 'Type the password again';
    else if (data.password !== data.confirmPassword) errors.confirmPassword = 'Passwords do not match';

    if (needTerms && !acceptedTerms) errors.terms = 'Please accept the terms to continue';
    return errors;
}

export function RegisterForm({
    onSubmit,
    isLoading = false,
    error,
    success = false,
    nameLabel = 'Full name',
    emailLabel = 'Email',
    passwordLabel = 'Password',
    confirmPasswordLabel = 'Confirm password',
    submitButtonText = 'Create account',
    successMessage = 'Account created successfully!',
    showTermsCheckbox = false,
    termsText = 'I agree to the Terms of Service and Privacy Policy',
    onTermsClick,
    termsContent,
    className = '',
}: RegisterFormProps) {
    const id = useId();
    const [formData, setFormData] = useState<RegisterFormData>({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

    const clearError = (field: FieldKey) => {
        if (!errors[field]) return;
        setErrors((prev) => {
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const handleChange = (field: keyof RegisterFormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        clearError(field);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const found = validate(formData, showTermsCheckbox, acceptedTerms);
        setErrors(found);
        const first = Object.keys(found)[0];
        if (first) {
            document.getElementById(`${id}-${first}`)?.focus();
            return;
        }
        await onSubmit({ ...formData, name: formData.name.trim(), email: formData.email.trim() });
    };

    /** aria wiring for a field: invalid flag plus its error (and any extra description) */
    const describe = (field: FieldKey, extra?: string) => ({
        'aria-invalid': errors[field] ? true : undefined,
        'aria-describedby':
            [errors[field] ? `${id}-${field}-error` : '', extra ?? ''].filter(Boolean).join(' ') || undefined,
    });
    const fieldError = (field: FieldKey) =>
        errors[field] ? (
            <p id={`${id}-${field}-error`} className="text-xs text-destructive">
                {errors[field]}
            </p>
        ) : null;

    if (success) {
        return (
            <Alert variant="success" className={`font-medium ${className}`}>
                <CheckCircle2 aria-hidden="true" />
                {successMessage}
            </Alert>
        );
    }

    return (
        <form onSubmit={handleSubmit} noValidate className={`space-y-4 ${className}`}>
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="space-y-2">
                <Label htmlFor={`${id}-name`}>{nameLabel}</Label>
                <Input
                    id={`${id}-name`}
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="name"
                    {...describe('name')}
                />
                {fieldError('name')}
            </div>

            <div className="space-y-2">
                <Label htmlFor={`${id}-email`}>{emailLabel}</Label>
                <Input
                    id={`${id}-email`}
                    type="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="email"
                    {...describe('email')}
                />
                {fieldError('email')}
            </div>

            <div className="space-y-2">
                <Label htmlFor={`${id}-password`}>{passwordLabel}</Label>
                <PasswordInput
                    id={`${id}-password`}
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="new-password"
                    {...describe('password', `${id}-rules`)}
                />
                <PasswordChecklist id={`${id}-rules`} password={formData.password} />
                {fieldError('password')}
            </div>

            <div className="space-y-2">
                <Label htmlFor={`${id}-confirmPassword`}>{confirmPasswordLabel}</Label>
                <PasswordInput
                    id={`${id}-confirmPassword`}
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="new-password"
                    {...describe('confirmPassword')}
                />
                {fieldError('confirmPassword')}
            </div>

            {showTermsCheckbox && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id={`${id}-terms`}
                            checked={acceptedTerms}
                            onCheckedChange={(checked) => {
                                const accepted = checked === true;
                                setAcceptedTerms(accepted);
                                if (accepted) clearError('terms');
                            }}
                            disabled={isLoading}
                            {...describe('terms')}
                        />
                        <Label htmlFor={`${id}-terms`} className="cursor-pointer text-sm font-normal leading-snug">
                            {termsContent ??
                                (onTermsClick ? (
                                    <button
                                        type="button"
                                        onClick={onTermsClick}
                                        className="text-primary hover:underline"
                                    >
                                        {termsText}
                                    </button>
                                ) : (
                                    termsText
                                ))}
                        </Label>
                    </div>
                    {fieldError('terms')}
                </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Spinner className="mr-2 h-4 w-4" />}
                {submitButtonText}
            </Button>
        </form>
    );
}
