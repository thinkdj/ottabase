import { api } from '@/lib/api';
import { isEmail } from '@ottabase/utils/string';
import type { MemberRole, MemberStatus, OrganizationMemberRecord } from '@/types/rbac';
import { OttaSelect, type ItemRendererProps, type OttaSelectItem } from '@ottabase/ottaselect';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Button,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@ottabase/ui-shadcn';
import { useEffect, useState } from 'react';

export interface InviteMemberFormProps {
    organizationId: string;
    editingMember?: OrganizationMemberRecord | null;
    onSubmit: (data: InviteMemberFormData) => Promise<void>;
    onCancel: () => void;
}

export interface InviteMemberFormData {
    userId?: string;
    email?: string;
    role: MemberRole;
    status?: MemberStatus;
}

interface InvitableUserRecord {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
}

interface InvitableUserSearchResponse {
    data: InvitableUserRecord[];
}

interface AdminUserDetailResponse {
    data: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
    };
}

export interface InvitableUserOption extends OttaSelectItem {
    email?: string;
    image?: string | null;
}

function normalizeRole(value: unknown): MemberRole {
    return value === 'owner' || value === 'admin' || value === 'member' ? value : 'member';
}

function normalizeStatus(value: unknown): MemberStatus {
    return value === 'active' || value === 'invited' || value === 'suspended' ? value : 'invited';
}

export async function searchInvitableUsers(searchQuery: string): Promise<InvitableUserOption[]> {
    const query = searchQuery.trim();
    if (query.length < 2) {
        return [];
    }

    const response = await api<InvitableUserSearchResponse>('/api/admin/users/search', {
        params: {
            q: query,
            limit: 12,
        },
    });

    return response.data.map((user) => ({
        id: user.id,
        name: user.name?.trim() || user.email?.trim() || user.id,
        email: user.email ?? '',
        image: user.image,
    }));
}

function getUserInitials(item: { name: string; email?: string }): string {
    const base = item.name || item.email || '?';
    return (
        base
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() || '')
            .join('') || '?'
    );
}

function UserOptionRow({ item }: ItemRendererProps) {
    const option = item as InvitableUserOption;

    return (
        <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
                <AvatarImage src={option.image || undefined} alt={option.name} />
                <AvatarFallback>{getUserInitials(option)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <div className="truncate text-sm font-medium">{option.name}</div>
                <div className="truncate text-xs text-muted-foreground">{option.email || option.id}</div>
            </div>
        </div>
    );
}

export function InviteMemberForm({ organizationId, editingMember, onSubmit, onCancel }: InviteMemberFormProps) {
    const isEditing = !!editingMember;
    const [loading, setLoading] = useState(false);
    const [inviteBy, setInviteBy] = useState<'existing' | 'email'>('existing');
    const [emailInput, setEmailInput] = useState('');
    const [emailError, setEmailError] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<InvitableUserOption | null>(null);
    const [formData, setFormData] = useState<InviteMemberFormData>({
        userId: '',
        role: 'member',
        status: 'invited',
    });

    useEffect(() => {
        if (!editingMember) {
            setInviteBy('existing');
            setEmailInput('');
            setEmailError(null);
            setSelectedUser(null);
            setFormData({
                userId: '',
                role: 'member',
                status: 'invited',
            });
            return;
        }

        let cancelled = false;

        const presetUser: InvitableUserOption = {
            id: editingMember.userId,
            name: editingMember.user?.name?.trim() || editingMember.user?.email?.trim() || editingMember.userId,
            email: editingMember.user?.email ?? '',
            image: editingMember.user?.image ?? null,
        };

        setSelectedUser(presetUser);
        setFormData({
            userId: editingMember.userId,
            role: normalizeRole(editingMember.role),
            status: normalizeStatus(editingMember.status),
        });

        const hydrateUserLabel = async () => {
            try {
                const response = await api<AdminUserDetailResponse>(`/api/admin/users/${editingMember.userId}`);
                if (cancelled || !response?.data) return;

                const user = response.data;
                setSelectedUser({
                    id: user.id,
                    name: user.name?.trim() || user.email?.trim() || user.id,
                    email: user.email ?? '',
                    image: user.image,
                });
            } catch {
                // Keep fallback label (userId) if lookup fails
            }
        };

        void hydrateUserLabel();

        return () => {
            cancelled = true;
        };
    }, [editingMember]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isEditing && inviteBy === 'email') {
            const email = emailInput.trim();
            if (!isEmail(email)) {
                setEmailError('Enter a valid email address');
                return;
            }
            setEmailError(null);
            setLoading(true);
            try {
                // No status: the server decides — 'active' if this email already has an account
                // and is added immediately, 'invited' (pending signup) otherwise.
                await onSubmit({ email, role: formData.role });
            } finally {
                setLoading(false);
            }
            return;
        }

        if (!formData.userId) {
            return;
        }
        setLoading(true);
        try {
            await onSubmit(formData);
        } finally {
            setLoading(false);
        }
    };

    const canSubmit = isEditing
        ? !!formData.userId
        : inviteBy === 'email'
          ? emailInput.trim().length > 0
          : !!formData.userId;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                {!isEditing && (
                    <div className="space-y-2">
                        <Label>Invite by</Label>
                        <Select value={inviteBy} onValueChange={(value: 'existing' | 'email') => setInviteBy(value)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="existing">Existing user</SelectItem>
                                <SelectItem value="email">Email address (invite someone new)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* User */}
                {(isEditing || inviteBy === 'existing') && (
                    <div className="space-y-2">
                        <Label>User*</Label>
                        <OttaSelect
                            mode="single"
                            value={selectedUser}
                            onChange={(value) => {
                                const nextUser = value as InvitableUserOption | null;
                                setSelectedUser(nextUser);
                                setFormData({
                                    ...formData,
                                    userId: nextUser?.id ?? '',
                                });
                            }}
                            fetchCollection={(query) => searchInvitableUsers(query)}
                            placeholder={isEditing ? 'Selected member' : 'Search by name, email, or user ID'}
                            searchPlaceholder="Type at least 2 characters..."
                            loadingMessage="Searching users..."
                            emptyMessage="No matching users found"
                            renderItem={UserOptionRow}
                            renderValue={(item) => {
                                const option = item as InvitableUserOption;
                                return (
                                    <span className="flex min-w-0 flex-col text-left leading-tight">
                                        <span className="truncate text-sm font-medium">{option.name}</span>
                                        <span className="truncate text-xs text-muted-foreground">
                                            {option.email || option.id}
                                        </span>
                                    </span>
                                );
                            }}
                            className="w-full"
                            disabled={isEditing || loading}
                        />
                        <p className="text-sm text-muted-foreground">
                            {isEditing
                                ? 'User cannot be changed while editing. Update role or status only.'
                                : "Admins can search by name, email, or user ID. The selected user's internal ID is stored."}
                        </p>
                    </div>
                )}

                {!isEditing && inviteBy === 'email' && (
                    <div className="space-y-2">
                        <Label htmlFor="invite-email">Email address*</Label>
                        <Input
                            id="invite-email"
                            type="email"
                            value={emailInput}
                            onChange={(e) => {
                                setEmailInput(e.target.value);
                                if (emailError) setEmailError(null);
                            }}
                            placeholder="name@example.com"
                            disabled={loading}
                        />
                        {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                        <p className="text-sm text-muted-foreground">
                            If no account exists for this email yet, they'll receive an invite to sign up. Once they
                            create an account with this email, they're automatically added to the organization.
                        </p>
                    </div>
                )}

                {/* Role */}
                <div className="space-y-2">
                    <Label htmlFor="role">Role*</Label>
                    <Select
                        value={formData.role}
                        onValueChange={(value: 'owner' | 'admin' | 'member') =>
                            setFormData({ ...formData, role: value })
                        }
                    >
                        <SelectTrigger id="role">
                            <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="owner">Owner (Full control)</SelectItem>
                            <SelectItem value="admin">Admin (Manage members)</SelectItem>
                            <SelectItem value="member">Member (Basic access)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Status */}
                {(isEditing || inviteBy === 'existing') && (
                    <div className="space-y-2">
                        <Label htmlFor="status">Status*</Label>
                        <Select
                            value={formData.status}
                            onValueChange={(value: 'active' | 'invited' | 'suspended') =>
                                setFormData({ ...formData, status: value })
                            }
                        >
                            <SelectTrigger id="status">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active (Access granted)</SelectItem>
                                <SelectItem value="invited">Invited (Pending acceptance)</SelectItem>
                                <SelectItem value="suspended">Suspended (Access revoked)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 border-t border-border/60 pt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    Cancel
                </Button>
                <Button type="submit" disabled={loading || !canSubmit}>
                    {loading ? (isEditing ? 'Saving...' : 'Inviting...') : isEditing ? 'Save Changes' : 'Invite Member'}
                </Button>
            </div>
        </form>
    );
}
