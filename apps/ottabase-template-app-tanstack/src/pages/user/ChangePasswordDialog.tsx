/**
 * Change Password Dialog
 *
 * Allows authenticated users to change their password.
 * Validates current password, enforces password strength requirements.
 */

import { api } from '@/lib/api';
import {
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    Input,
    Label,
    Separator,
} from '@ottabase/ui-shadcn';
import { Check, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { useState } from 'react';

interface ChangePasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

const PASSWORD_RULES = [
    { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
    { label: 'Number', test: (p: string) => /\d/.test(p) },
    { label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function ChangePasswordDialog({ open, onOpenChange, onSuccess }: ChangePasswordDialogProps) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const allRulesPassed = PASSWORD_RULES.every((r) => r.test(newPassword));
    const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
    const canSubmit = currentPassword.length > 0 && allRulesPassed && passwordsMatch && !isLoading;

    function resetForm() {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowCurrent(false);
        setShowNew(false);
        setError(null);
        setSuccess(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;

        setIsLoading(true);
        setError(null);

        try {
            await api('/api/auth/password/change', {
                method: 'POST',
                body: { currentPassword, newPassword },
            });
            setSuccess(true);
            onSuccess?.();
            setTimeout(() => {
                onOpenChange(false);
                resetForm();
            }, 1500);
        } catch (err: any) {
            setError(err?.message || 'Failed to change password');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) resetForm();
                onOpenChange(v);
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogTitle>Change password</DialogTitle>

                {success ? (
                    <div className="flex flex-col items-center gap-3 py-6">
                        <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3">
                            <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-sm font-medium">Password updated successfully</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="current-password">Current password</Label>
                            <div className="relative">
                                <Input
                                    id="current-password"
                                    type={showCurrent ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    autoComplete="current-password"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowCurrent((v) => !v)}
                                    tabIndex={-1}
                                >
                                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label htmlFor="new-password">New password</Label>
                            <div className="relative">
                                <Input
                                    id="new-password"
                                    type={showNew ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    autoComplete="new-password"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowNew((v) => !v)}
                                    tabIndex={-1}
                                >
                                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>

                            {newPassword.length > 0 && (
                                <ul className="space-y-1 text-xs mt-2">
                                    {PASSWORD_RULES.map((rule) => {
                                        const passed = rule.test(newPassword);
                                        return (
                                            <li
                                                key={rule.label}
                                                className={`flex items-center gap-1.5 ${passed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
                                            >
                                                {passed ? (
                                                    <Check className="h-3 w-3" />
                                                ) : (
                                                    <X className="h-3 w-3" />
                                                )}
                                                {rule.label}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm new password</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                                disabled={isLoading}
                            />
                            {confirmPassword.length > 0 && !passwordsMatch && (
                                <p className="text-xs text-destructive">Passwords do not match</p>
                            )}
                        </div>

                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    onOpenChange(false);
                                    resetForm();
                                }}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" size="sm" disabled={!canSubmit}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update password
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
