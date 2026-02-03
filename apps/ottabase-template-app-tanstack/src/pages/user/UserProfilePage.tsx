/**
 * User Profile Page
 *
 * Current user account management
 * GitHub-like minimal UI with dark mode support
 */

import { useRBACToast } from '@/hooks/useToast';
import { useSession } from '@/lib/auth';
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
import { useState } from 'react';

export function UserProfilePage() {
    const { user } = useSession();
    const toast = useRBACToast();

    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const userInitials = user?.name
        ? user.name
              .split(' ')
              .filter((n) => n.length > 0)
              .map((n) => n[0])
              .join('')
              .toUpperCase()
        : user?.email?.[0]?.toUpperCase() || '?';

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // TODO: Implement user update API
            await new Promise((resolve) => setTimeout(resolve, 1000));
            toast.success('Profile updated', 'Your profile has been updated successfully');
            setHasChanges(false);
        } catch (error) {
            toast.error('Update failed', 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-muted-foreground">Please sign in to view your profile</p>
            </div>
        );
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
                            disabled={isSaving}
                        />
                        <p className="text-sm text-muted-foreground">Your email is used for login and notifications</p>
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
