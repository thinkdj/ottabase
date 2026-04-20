import { api } from '@/lib/api';
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
    userId: string;
    role: MemberRole;
    status: MemberStatus;
    /** When set, sends an email invite (works for users without an account yet). */
    inviteEmail?: string;
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

export function InviteMemberForm({ editingMember, onSubmit, onCancel }: InviteMemberFormProps) {
    const isEditing = !!editingMember;
    const [loading, setLoading] = useState(false);
    const [inviteMode, setInviteMode] = useState<'user' | 'email'>('user');
    const [inviteEmail, setInviteEmail] = useState('');
    const [selectedUser, setSelectedUser] = useState<InvitableUserOption | null>(null);
    const [formData, setFormData] = useState<InviteMemberFormData>({
        userId: '',
        role: 'member',
        status: 'invited',
    });

    useEffect(() => {
        if (!editingMember) {
            setSelectedUser(null);
            setInviteMode('user');
            setInviteEmail('');
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

        setInviteMode('user');
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
        if (!isEditing && inviteMode === 'email') {
            const trimmed = inviteEmail.trim();
            if (!trimmed || !trimmed.includes('@')) {
                return;
            }
            setLoading(true);
            try {
                await onSubmit({
                    userId: '',
                    role: formData.role,
                    status: 'invited',
                    inviteEmail: trimmed,
                });
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

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                {!isEditing && (
                    <div className="space-y-2">
                        <Label htmlFor="invite-mode">How to invite</Label>
                        <Select value={inviteMode} onValueChange={(v: 'user' | 'email') => setInviteMode(v)}>
                            <SelectTrigger id="invite-mode">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="user">Existing user (search)</SelectItem>
                                <SelectItem value="email">Anyone by email (link to accept)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {!isEditing && inviteMode === 'email' ? (
                    <div className="space-y-2">
                        <Label htmlFor="invite-email">Email address*</Label>
                        <Input
                            id="invite-email"
                            type="email"
                            autoComplete="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="colleague@company.com"
                            required
                        />
                        <p className="text-sm text-muted-foreground">
                            We send a secure link. They can sign up or sign in with this email to accept.
                        </p>
                    </div>
                ) : null}

                {/* User */}
                <div className={`space-y-2 ${!isEditing && inviteMode === 'email' ? 'hidden' : ''}`}>
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

                {/* Status — not used for email-link invites */}
                <div className={`space-y-2 ${!isEditing && inviteMode === 'email' ? 'hidden' : ''}`}>
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
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    disabled={
                        loading ||
                        (isEditing
                            ? !formData.userId
                            : inviteMode === 'email'
                              ? !inviteEmail.trim().includes('@')
                              : !formData.userId)
                    }
                >
                    {loading ? (isEditing ? 'Saving...' : 'Inviting...') : isEditing ? 'Save Changes' : 'Invite Member'}
                </Button>
            </div>
        </form>
    );
}
