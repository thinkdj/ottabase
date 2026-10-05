/**
 * User Profile Page
 *
 * Current user account management
 * GitHub-like minimal UI with dark mode support
 */

import { useRBACToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { useSession, type User as SessionUser } from '@/lib/auth';
import { MEDIA_LIBRARY_ENABLED, PACKAGES_ENABLED } from '@/ottabase/config';
import { changePassword, requestEmailVerification } from '@/lib/auth-api';
import { AiPersonalProviders } from './AiPersonalProviders';
import { OttaSelect, type OttaSelectItem } from '@ottabase/ottaselect';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Alert,
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
    Dialog,
    DialogContent,
    DialogTitle,
    Input,
    Label,
    Separator,
} from '@ottabase/ui-shadcn';
import { PasswordChecklist, PasswordInput } from '@ottabase/auth/components';
import { getProviderDisplayName, isStrongPassword, PASSWORD_POLICY_MESSAGE } from '@ottabase/auth/config';
import { invalidateAuthSession } from '@ottabase/auth/react';
import { getTimezonesForSelect, setTimezoneConfig } from '@ottabase/utils/timezone';
import { IconExternalLink, IconPencil, IconTrash } from '@tabler/icons-react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Calendar, Check, Loader2, Mail, User } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AvatarEditModal } from './AvatarEditModal';
import { ActiveSessions } from './ActiveSessions';
import { SignInMethods, type LinkedAccountRecord } from './SignInMethods';

interface UserProfileRecord {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    timezone?: string | null;
    emailVerified?: number | null;
    createdAt?: number | null;
    updatedAt?: number | null;
    linkedAccounts?: LinkedAccountRecord[];
    hasPassword?: boolean;
}

type SessionProfileUpdate = Partial<
    Pick<UserProfileRecord, 'name' | 'email' | 'image' | 'timezone' | 'emailVerified' | 'createdAt' | 'updatedAt'>
>;

const LINK_ERRORS: Record<string, string> = {
    OAuthAccountInUse: 'That account is already connected to a different user.',
    SessionRequired: 'Your session ended before the provider answered. Sign in and try again.',
    OAuthCallback: 'The provider did not complete the connection. Try again.',
};

function getSessionTimezone(user: SessionUser | null): string {
    const timezone: unknown = user?.timezone;
    return typeof timezone === 'string' ? timezone : '';
}

function normalize(value: string): string {
    return value.trim();
}

export function UserProfilePage() {
    const { user, updateUser, refreshSession } = useSession();
    const toast = useRBACToast();
    const sessionTimezone = getSessionTimezone(user);

    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        timezone: sessionTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    });

    const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccountRecord[]>([]);
    const [isAccountsLoading, setIsAccountsLoading] = useState(true);
    const [hasPassword, setHasPassword] = useState(false);
    const [avatarModalOpen, setAvatarModalOpen] = useState(false);
    const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
    const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
    const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    // OttaSelect items: id = IANA name, name = display label (searchable). Browser timezone always first.
    const browserTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
    const timezoneItems = useMemo(
        () =>
            getTimezonesForSelect({ preferredTimezone: browserTz || undefined }).map((tz) => ({
                id: tz.name,
                name: tz.label,
                offset: tz.offset,
            })),
        [browserTz],
    );

    // Current value for OttaSelect (find in list or create synthetic for saved tz not in list)
    const timezoneValue = useMemo((): OttaSelectItem | null => {
        const tz = formData.timezone?.trim();
        if (!tz) return null;
        const found = timezoneItems.find((i) => i.id === tz);
        return found ?? { id: tz, name: tz.replace(/_/g, ' ') };
    }, [formData.timezone, timezoneItems]);

    const computeHasChanges = useCallback(
        (next: { name: string; email: string; timezone: string }) => {
            const currentName = normalize(user?.name ?? '');
            const currentEmail = normalize(user?.email ?? '');
            return (
                normalize(next.name) !== currentName ||
                normalize(next.email) !== currentEmail ||
                normalize(next.timezone) !== sessionTimezone
            );
        },
        [sessionTimezone, user?.email, user?.name],
    );

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                timezone: sessionTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            });
            setHasChanges(false);
        }
    }, [sessionTimezone, user]);

    // Fetch full profile (including timezone) - the session may not include DB-only fields
    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;

        async function loadProfile() {
            setIsAccountsLoading(true);
            try {
                const data = await api<UserProfileRecord>('/api/users/me');
                if (!cancelled && data) {
                    setLinkedAccounts(data?.linkedAccounts || []);
                    setHasPassword(data?.hasPassword === true);
                    const tz = data.timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
                    setFormData((prev) => ({
                        ...prev,
                        name: data.name ?? prev.name,
                        email: data.email ?? prev.email,
                        timezone: tz,
                    }));
                    // Sync session so computeHasChanges and future visits have timezone
                    updateUser({ timezone: tz } satisfies Partial<SessionUser>);
                }
            } catch (error) {
                console.error('Failed to load profile', error);
            } finally {
                if (!cancelled) {
                    setIsAccountsLoading(false);
                }
            }
        }

        loadProfile();

        return () => {
            cancelled = true;
        };
    }, [updateUser, user?.id]);

    // Back from connecting a provider: say how it went, then drop the flag from the address
    const navigate = useNavigate();
    const search = useSearch({ strict: false }) as { linked?: string; linkError?: string };
    useEffect(() => {
        if (!search.linked && !search.linkError) return;
        if (search.linked) toast.success(`${getProviderDisplayName(search.linked)} connected`);
        else toast.error(LINK_ERRORS[search.linkError ?? ''] ?? 'Could not connect that account');
        navigate({ to: '/profile', search: {} as never, replace: true });
    }, [search.linked, search.linkError, navigate]);

    const userInitials = user?.name
        ? user.name
              .split(' ')
              .filter((n) => n.length > 0)
              .map((n) => n[0])
              .join('')
              .toUpperCase()
        : user?.email?.[0]?.toUpperCase() || '?';

    const handleChange = (field: 'name' | 'email' | 'timezone', value: string) => {
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
            const trimmedTimezone = normalize(formData.timezone);

            if (!trimmedName) {
                toast.error('Name is required', 'Please enter your full name.');
                return;
            }

            const updates: { name?: string; timezone?: string | null } = {};

            if (trimmedName !== normalize(user.name ?? '')) {
                updates.name = trimmedName;
            }

            if (trimmedEmail !== normalize(user.email ?? '')) {
                toast.warning('Email changes are disabled', 'Contact support to update your login email.');
                setFormData((prev) => ({ ...prev, email: user.email ?? '' }));
                setHasChanges(
                    computeHasChanges({ name: trimmedName, email: user.email ?? '', timezone: formData.timezone }),
                );
                return;
            }

            if (trimmedTimezone !== sessionTimezone) {
                updates.timezone = trimmedTimezone || null;
            }

            if (Object.keys(updates).length === 0) {
                toast.info('No changes to save');
                setHasChanges(false);
                return;
            }

            const updatedUser = await api<UserProfileRecord>('/api/users/me', {
                method: 'PATCH',
                body: updates,
            });

            const safeUpdates: SessionProfileUpdate = {};
            if (updatedUser.name !== undefined) safeUpdates.name = updatedUser.name;
            if (updatedUser.email !== undefined) safeUpdates.email = updatedUser.email;
            if (updatedUser.image !== undefined) safeUpdates.image = updatedUser.image;
            if (updatedUser.timezone !== undefined) safeUpdates.timezone = updatedUser.timezone;
            if (updatedUser.emailVerified !== undefined) safeUpdates.emailVerified = updatedUser.emailVerified;
            if (updatedUser.createdAt !== undefined) safeUpdates.createdAt = updatedUser.createdAt;
            if (updatedUser.updatedAt !== undefined) safeUpdates.updatedAt = updatedUser.updatedAt;

            if (Object.keys(safeUpdates).length > 0) {
                updateUser(safeUpdates satisfies Partial<SessionUser>);
                if (typeof safeUpdates.timezone === 'string' && safeUpdates.timezone) {
                    setTimezoneConfig({ userTimezone: safeUpdates.timezone });
                }
            }

            setFormData({
                name: updatedUser.name ?? user.name ?? '',
                email: updatedUser.email ?? user.email ?? '',
                timezone: updatedUser.timezone ?? formData.timezone,
            });
            if (updatedUser.linkedAccounts) {
                setLinkedAccounts(updatedUser.linkedAccounts);
            }
            await refreshSession();
            // refreshSession replaces the whole session from the server, which does NOT carry
            // the client-only timezone (it isn't part of the session snapshot). Re-apply the
            // just-saved value so it isn't reverted to the browser default (phantom "unsaved").
            if (typeof safeUpdates.timezone === 'string' && safeUpdates.timezone) {
                updateUser({ timezone: safeUpdates.timezone } satisfies Partial<SessionUser>);
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

    const resetPasswordDialogState = () => {
        setPasswordError(null);
        setPasswordForm({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        });
    };

    const handleChangePassword = async () => {
        setPasswordError(null);

        const currentPassword = passwordForm.currentPassword.trim();
        const newPassword = passwordForm.newPassword.trim();
        const confirmPassword = passwordForm.confirmPassword.trim();

        if (!currentPassword) {
            setPasswordError('Current password is required.');
            return;
        }

        if (!newPassword) {
            setPasswordError('New password is required.');
            return;
        }

        if (!isStrongPassword(newPassword)) {
            setPasswordError(PASSWORD_POLICY_MESSAGE);
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('New password and confirmation do not match.');
            return;
        }

        if (newPassword === currentPassword) {
            setPasswordError('New password must be different from current password.');
            return;
        }

        setIsChangingPassword(true);
        try {
            const result = await changePassword({ currentPassword, newPassword });
            if (!result.success) {
                throw new Error(result.error || 'Failed to update password.');
            }

            toast.success('Password updated', 'Please sign in again with your new password.');
            resetPasswordDialogState();
            setIsPasswordDialogOpen(false);
            invalidateAuthSession();
            if (typeof window !== 'undefined') {
                window.location.href = '/login?passwordChanged=1';
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update password.';
            setPasswordError(message);
            toast.error('Password update failed', message);
        } finally {
            setIsChangingPassword(false);
        }
    };

    if (!user) {
        return null;
    }

    return (
        <div className="mx-auto max-w-3xl space-y-8">
            {/* Header */}
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Your account</h1>
                    <p className="text-muted-foreground">Profile, sign-in methods and security</p>
                </div>
                {MEDIA_LIBRARY_ENABLED && (
                    <div>
                        <Button variant="outline" size="sm" asChild>
                            <Link to="/media-library">Open My Uploads</Link>
                        </Button>
                    </div>
                )}
            </div>

            {/* Profile Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <User className="h-4 w-4 text-muted-foreground" />
                        Public Profile
                    </CardTitle>
                    <CardDescription>Your profile information visible to others</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Avatar with edit pencil */}
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            {user.image ? (
                                <button
                                    type="button"
                                    onClick={() => setAvatarPreviewOpen(true)}
                                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    aria-label="View profile picture"
                                >
                                    <Avatar className="h-20 w-20 cursor-pointer ring-1 ring-border ring-offset-2 ring-offset-background transition-opacity duration-normal hover:opacity-90">
                                        <AvatarImage src={user.image} />
                                        <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
                                    </Avatar>
                                </button>
                            ) : (
                                <Avatar className="h-20 w-20 ring-1 ring-border ring-offset-2 ring-offset-background">
                                    <AvatarImage src={undefined} />
                                    <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
                                </Avatar>
                            )}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setAvatarModalOpen(true);
                                }}
                                className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-background text-muted-foreground shadow-sm ring-1 ring-border transition-colors duration-normal hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label="Edit profile picture"
                            >
                                <IconPencil className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-[0.9375rem] font-semibold">{formData.name || 'No name set'}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                {formData.email}
                            </div>
                        </div>
                    </div>

                    <AvatarEditModal
                        open={avatarModalOpen}
                        onOpenChange={setAvatarModalOpen}
                        hasImage={!!user.image}
                        currentImageUrl={user.image ?? undefined}
                        onSuccess={(imageUrl) => {
                            updateUser({ image: imageUrl });
                            if (refreshSession) refreshSession();
                            toast.success('Profile picture updated', 'Your avatar has been updated.');
                        }}
                        onRemove={() => {
                            updateUser({ image: null });
                            if (refreshSession) refreshSession();
                            toast.success('Profile picture removed', 'Your avatar has been removed.');
                        }}
                        onError={(msg) => toast.error('Avatar update failed', msg)}
                    />

                    {/* Avatar preview modal - shows image large when clicking existing avatar */}
                    <Dialog open={avatarPreviewOpen} onOpenChange={setAvatarPreviewOpen}>
                        <DialogContent className="max-w-2xl p-4 sm:p-6">
                            <DialogTitle className="sr-only">Profile picture</DialogTitle>
                            <div className="flex flex-col items-center gap-4">
                                <img
                                    src={user.image || ''}
                                    alt="Profile picture"
                                    className="max-h-[70vh] w-auto max-w-full rounded-full object-contain"
                                />
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() => window.open(user.image || '', '_blank', 'noopener,noreferrer')}
                                    >
                                        <IconExternalLink className="mr-2 h-4 w-4" />
                                        Open in new tab
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => setRemoveConfirmOpen(true)}
                                    >
                                        <IconTrash className="mr-2 h-4 w-4" />
                                        Remove profile picture
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Remove profile picture confirmation */}
                    <ConfirmDialog
                        open={removeConfirmOpen}
                        onOpenChange={setRemoveConfirmOpen}
                        title="Remove profile picture?"
                        description="Are you sure you want to remove your profile picture? You can add a new one anytime."
                        tone="destructive"
                        secondaryActionText="Cancel"
                        primaryActionText={
                            isRemovingAvatar ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Removing...
                                </>
                            ) : (
                                'Remove'
                            )
                        }
                        onConfirm={async (e) => {
                            e.preventDefault();
                            setIsRemovingAvatar(true);
                            try {
                                await api('/api/users/me', {
                                    method: 'PATCH',
                                    body: { image: null },
                                });
                                updateUser({ image: null });
                                if (refreshSession) refreshSession();
                                setAvatarPreviewOpen(false);
                                setRemoveConfirmOpen(false);
                                toast.success('Profile picture removed', 'Your avatar has been removed.');
                            } catch (err) {
                                setRemoveConfirmOpen(false);
                                toast.error('Remove failed', 'Failed to remove profile picture');
                            } finally {
                                setIsRemovingAvatar(false);
                            }
                        }}
                        confirmProps={{ disabled: isRemovingAvatar }}
                        cancelProps={{ disabled: isRemovingAvatar }}
                    />

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

                    {/* Timezone */}
                    <div className="space-y-2">
                        <Label htmlFor="timezone">Timezone</Label>
                        <OttaSelect
                            mode="single"
                            items={timezoneItems}
                            value={timezoneValue}
                            onChange={(v) => handleChange('timezone', (v as OttaSelectItem)?.id ?? '')}
                            placeholder="Select timezone"
                            searchable
                            searchPlaceholder="Search timezones..."
                            disabled={isSaving}
                            clearable={false}
                            className="w-full"
                        />
                        <p className="text-sm text-muted-foreground">
                            Used for displaying dates and times in your local timezone.
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
                    <CardTitle className="text-[0.9375rem] font-semibold">Account Information</CardTitle>
                    <CardDescription>Your account details and status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Email Verified */}
                    <div className="space-y-2">
                        <Label>Email Status</Label>
                        <div>
                            {user.emailVerified ? (
                                <Badge
                                    variant="outline"
                                    className="gap-1 rounded-full border-transparent bg-background text-success ring-1 ring-border"
                                >
                                    <Check className="h-3 w-3" />
                                    Verified
                                </Badge>
                            ) : (
                                <Badge
                                    variant="outline"
                                    className="rounded-full border-transparent bg-background text-muted-foreground ring-1 ring-border"
                                >
                                    Not Verified
                                </Badge>
                            )}
                        </div>
                    </div>
                    {!user.emailVerified && (
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                                Verify your email to unlock all account features.
                            </p>
                            {verificationError && <Alert variant="destructive">{verificationError}</Alert>}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleResendVerification}
                                disabled={verificationStatus === 'sending'}
                            >
                                {verificationStatus === 'sending' ? 'Sending...' : 'Resend verification email'}
                            </Button>
                            {verificationStatus === 'sent' && (
                                <p className="text-xs font-medium text-success">Verification email sent.</p>
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
                            {user.createdAt
                                ? new Date(user.createdAt).toLocaleDateString(undefined, {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                  })
                                : 'Unknown'}
                        </p>
                    </div>

                    {/* Support and API work need the id; nobody else does */}
                    <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground">Developer details</summary>
                        <div className="mt-2 flex items-center gap-2">
                            <code className="min-w-0 flex-1 truncate rounded-lg bg-background px-3 py-2 text-xs ring-1 ring-border">
                                {user.id}
                            </code>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    navigator.clipboard.writeText(user.id);
                                    toast.success('Copied', 'User ID copied to clipboard');
                                }}
                            >
                                Copy ID
                            </Button>
                        </div>
                    </details>
                </CardContent>
            </Card>

            <SignInMethods
                linkedAccounts={linkedAccounts}
                hasPassword={hasPassword}
                loading={isAccountsLoading}
                onChanged={setLinkedAccounts}
            />

            {/* Security */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Security</CardTitle>
                    <CardDescription>Keep your account safe</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h4 className="text-sm font-medium">Password</h4>
                            <p className="text-sm text-muted-foreground">Changing it signs you out everywhere.</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                resetPasswordDialogState();
                                setIsPasswordDialogOpen(true);
                            }}
                        >
                            Change password
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <ActiveSessions />

            {/* AI providers (personal keys). Dormant unless the ottaai package is enabled. */}
            {PACKAGES_ENABLED.ottaai ? <AiPersonalProviders /> : null}

            <Dialog
                open={isPasswordDialogOpen}
                onOpenChange={(open) => {
                    setIsPasswordDialogOpen(open);
                    if (!open) {
                        resetPasswordDialogState();
                    }
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogTitle>Change password</DialogTitle>
                    <form
                        className="space-y-4"
                        noValidate
                        onSubmit={(e) => {
                            e.preventDefault();
                            void handleChangePassword();
                        }}
                    >
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Current password</Label>
                            <PasswordInput
                                id="currentPassword"
                                autoComplete="current-password"
                                value={passwordForm.currentPassword}
                                onChange={(e) =>
                                    setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                                }
                                disabled={isChangingPassword}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New password</Label>
                            <PasswordInput
                                id="newPassword"
                                autoComplete="new-password"
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                                disabled={isChangingPassword}
                                aria-describedby="newPassword-rules"
                            />
                            <PasswordChecklist id="newPassword-rules" password={passwordForm.newPassword} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm new password</Label>
                            <PasswordInput
                                id="confirmPassword"
                                autoComplete="new-password"
                                value={passwordForm.confirmPassword}
                                onChange={(e) =>
                                    setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                                }
                                disabled={isChangingPassword}
                            />
                        </div>

                        {passwordError && <Alert variant="destructive">{passwordError}</Alert>}

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsPasswordDialogOpen(false)}
                                disabled={isChangingPassword}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isChangingPassword}>
                                {isChangingPassword ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Updating…
                                    </>
                                ) : (
                                    'Update password'
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
