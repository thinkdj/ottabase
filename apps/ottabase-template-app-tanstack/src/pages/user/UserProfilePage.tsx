/**
 * User Profile Page
 *
 * Current user account management
 * GitHub-like minimal UI with dark mode support
 */

import { useRBACToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { requestEmailVerification } from '@/lib/auth-api';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Separator,
} from '@ottabase/ui-shadcn';
import { Calendar, Check, Loader2, Mail, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface LinkedAccountRecord {
    provider: string;
    type: string;
    createdAt?: number | null;
}

export function UserProfilePage() {
    const { user, updateUser, refreshSession } = useSession({ skipAutoSync: true });
    const toast = useRBACToast();

    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
    });

    const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccountRecord[]>([]);
    const [isAccountsLoading, setIsAccountsLoading] = useState(true);

    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [verificationError, setVerificationError] = useState<string | null>(null);

    const normalize = useCallback((value: string) => value.trim(), []);

    const computeHasChanges = useCallback(
        (next: { name: string; email: string }) => {
            const currentName = normalize(user?.name ?? '');
            const currentEmail = normalize(user?.email ?? '');
            return normalize(next.name) !== currentName || normalize(next.email) !== currentEmail;
        },
        [normalize, user?.email, user?.name],
    );

    useEffect(() => {
        setFormData({
            name: user?.name || '',
            email: user?.email || '',
        });
        setHasChanges(false);
    }, [user?.name, user?.email]);

    useEffect(() => {
        let cancelled = false;

        async function loadLinkedAccounts() {
            setIsAccountsLoading(true);
            try {
                const data = await api<{ linkedAccounts?: LinkedAccountRecord[] }>('/api/users/me');
                if (!cancelled) {
                    setLinkedAccounts(data?.linkedAccounts || []);
                }
            } catch (error) {
                console.error('Failed to load linked accounts', error);
            } finally {
                if (!cancelled) {
                    setIsAccountsLoading(false);
                }
            }
        }

        loadLinkedAccounts();

        return () => {
            cancelled = true;
        };
    }, []);

    const userInitials = user?.name
        ? user.name
              .split(' ')
              .filter((n) => n.length > 0)
              .map((n) => n[0])
              .join('')
              .toUpperCase()
        : user?.email?.[0]?.toUpperCase() || '?';

    const handleChange = (field: 'name' | 'email', value: string) => {
        setFormData((prev) => {
            const next = { ...prev, [field]: value };
            setHasChanges(computeHasChanges(next));
            return next;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (!user?.id) {
                toast.error('Profile unavailable', 'Please log in again.');
                return;
            }

            const trimmedName = normalize(formData.name);
            const trimmedEmail = normalize(formData.email);

            if (!trimmedName) {
                toast.error('Name is required', 'Please enter your full name.');
                return;
            }

            const updates: Record<string, string> = {};

            if (trimmedName !== normalize(user.name ?? '')) {
                updates.name = trimmedName;
            }

            if (trimmedEmail !== normalize(user.email ?? '')) {
                toast.warning('Email changes are disabled', 'Contact support to update your login email.');
                setFormData((prev) => ({ ...prev, email: user.email ?? '' }));
                setHasChanges(computeHasChanges({ name: trimmedName, email: user.email ?? '' }));
                return;
            }

            if (Object.keys(updates).length === 0) {
                toast.info('No changes to save');
                setHasChanges(false);
                return;
            }

            const response = await api<Record<string, any>>('/api/users/me', {
                method: 'PATCH',
                body: updates,
            });

            const updatedUser = (
                response && typeof response === 'object' && 'data' in response
                    ? (response as { data?: Record<string, any> }).data
                    : response
            ) as Record<string, any> | undefined;

            const safeUpdates: Record<string, any> = {};
            if (updatedUser?.name !== undefined) safeUpdates.name = updatedUser.name;
            if (updatedUser?.email !== undefined) safeUpdates.email = updatedUser.email;
            if (updatedUser?.image !== undefined) safeUpdates.image = updatedUser.image;
            if (updatedUser?.emailVerified !== undefined) safeUpdates.emailVerified = updatedUser.emailVerified;
            if (updatedUser?.createdAt !== undefined) safeUpdates.createdAt = updatedUser.createdAt;
            if (updatedUser?.updatedAt !== undefined) safeUpdates.updatedAt = updatedUser.updatedAt;

            if (Object.keys(safeUpdates).length > 0) {
                updateUser(safeUpdates);
            }

            setFormData({
                name: updatedUser?.name ?? user.name ?? '',
                email: updatedUser?.email ?? user.email ?? '',
            });
            if (updatedUser?.linkedAccounts) {
                setLinkedAccounts(updatedUser.linkedAccounts);
            }
            if (refreshSession) {
                await refreshSession();
            }
            setHasChanges(false);
            toast.success('Profile updated', 'Your profile has been updated successfully');
        } catch (error) {
            toast.error('Update failed', 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResendVerification = async () => {
        if (!user?.email) {
            toast.error('Email required', 'Please add an email address first.');
            return;
        }

        setVerificationStatus('sending');
        setVerificationError(null);

        try {
            const result = await requestEmailVerification(user.email);
            if (!result.success) {
                throw new Error(result.error || 'Failed to send verification email');
            }
            setVerificationStatus('sent');
            toast.success('Verification sent', 'Check your inbox for the verification link.');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to send verification email';
            setVerificationError(message);
            toast.error('Verification failed', message);
            setVerificationStatus('idle');
        }
    };

    if (!user) {
        return null;
    }

    return (
        <div className="space-y-6 max-w-3xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Profile Settings</h1>
                <p className="text-muted-foreground mt-1">Manage your account settings and preferences</p>
            </div>

            {/* Profile Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Public Profile
                    </CardTitle>
                    <CardDescription>Your profile information visible to others</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Avatar */}
                    <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={user.image || undefined} />
                            <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-2">
                            <h3 className="font-semibold">{formData.name || 'No name set'}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                {formData.email}
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            placeholder="Enter your full name"
                            disabled={isSaving}
                        />
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            disabled
                            readOnly
                        />
                        <p className="text-sm text-muted-foreground">
                            Your email is used for login and notifications. Email changes require verification and are
                            disabled for now.
                        </p>
                    </div>

                    {/* Save Button */}
                    {hasChanges && (
                        <div className="pt-2">
                            <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Check className="mr-2 h-4 w-4" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Account Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Account Information</CardTitle>
                    <CardDescription>Your account details and status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* User ID */}
                    <div className="space-y-2">
                        <Label>User ID</Label>
                        <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-3 py-2 rounded flex-1">{user.id}</code>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    navigator.clipboard.writeText(user.id);
                                    toast.success('Copied', 'User ID copied to clipboard');
                                }}
                            >
                                Copy
                            </Button>
                        </div>
                    </div>

                    {/* Email Verified */}
                    <div className="space-y-2">
                        <Label>Email Status</Label>
                        <div>
                            {user.emailVerified ? (
                                <Badge variant="default" className="gap-1">
                                    <Check className="h-3 w-3" />
                                    Verified
                                </Badge>
                            ) : (
                                <Badge variant="secondary">Not Verified</Badge>
                            )}
                        </div>
                    </div>
                    {!user.emailVerified && (
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                                Verify your email to unlock all account features.
                            </p>
                            {verificationError && <p className="text-sm text-destructive">{verificationError}</p>}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleResendVerification}
                                disabled={verificationStatus === 'sending'}
                            >
                                {verificationStatus === 'sending' ? 'Sending...' : 'Resend verification email'}
                            </Button>
                            {verificationStatus === 'sent' && (
                                <p className="text-xs text-green-600">Verification email sent.</p>
                            )}
                        </div>
                    )}

                    {/* Account Created */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Member Since
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Linked Providers</CardTitle>
                    <CardDescription>Sign-in methods associated with this account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {isAccountsLoading ? (
                        <p className="text-sm text-muted-foreground">Loading linked providers...</p>
                    ) : linkedAccounts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Only credential-based (email/password) sign-in is available.
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {linkedAccounts.map((account) => (
                                <div
                                    key={`${account.provider}-${account.createdAt || 'unknown'}`}
                                    className="border border-border rounded-lg px-3 py-2 flex flex-col gap-1"
                                >
                                    <span className="text-base font-semibold">{account.provider}</span>
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                        {account.type}
                                    </span>
                                    {account.createdAt && (
                                        <span className="text-xs text-muted-foreground">
                                            Connected{' '}
                                            {new Date(account.createdAt).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Security */}
            <Card>
                <CardHeader>
                    <CardTitle>Security</CardTitle>
                    <CardDescription>Manage your account security settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium">Password</h4>
                            <p className="text-sm text-muted-foreground">
                                Password management is not available from this app.
                            </p>
                        </div>
                        <Button variant="outline" size="sm" disabled>
                            Change Password
                        </Button>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium">Two-Factor Authentication</h4>
                            <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                        </div>
                        <Button variant="outline" size="sm" disabled>
                            Enable 2FA
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
