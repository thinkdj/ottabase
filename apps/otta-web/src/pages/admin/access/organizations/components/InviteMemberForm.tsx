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
    /** Present when inviting an existing registered user */
    userId?: string;
    /** Present when sending an email invite (no account yet) */
    invitedEmail?: string;
    role: MemberRole;
    status: MemberStatus;
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
    // 'user' = search existing user, 'email' = email-only invite
    const [inviteMode, setInviteMode] = useState<'user' | 'email'>('user');
    const [selectedUser, setSelectedUser] = useState<InvitableUserOption | null>(null);
    const [emailInput, setEmailInput] = useState('');
    const [formData, setFormData] = useState<InviteMemberFormData>({
        userId: undefined,
        invitedEmail: undefined,
        role: 'member',
        status: 'invited',
    });

    useEffect(() => {
        if (!editingMember) {
            setSelectedUser(null);
            setEmailInput('');
            setInviteMode('user');
            setFormData({ userId: undefined, invitedEmail: undefined, role: 'member', status: 'invited' });
            return;
        }

        let cancelled = false;

        // Determine mode from the editing member
        if (editingMember.userId) {
            setInviteMode('user');
            const presetUser: InvitableUserOption = {
                id: editingMember.userId,
                name: editingMember.user?.name?.trim() || editingMember.user?.email?.trim() || editingMember.userId,
                email: editingMember.user?.email ?? '',
                image: editingMember.user?.image ?? null,
            };
            setSelectedUser(presetUser);
            setEmailInput('');
            setFormData({
                userId: editingMember.userId,
                invitedEmail: undefined,
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
                    // Keep fallback label if lookup fails
                }
            };
            void hydrateUserLabel();
        } else {
            // Pending email invite
            setInviteMode('email');
            setSelectedUser(null);
            const email = editingMember.invitedEmail ?? '';
            setEmailInput(email);
            setFormData({
                userId: undefined,
                invitedEmail: email,
                role: normalizeRole(editingMember.role),
                status: normalizeStatus(editingMember.status),
            });
        }

        return () => {
            cancelled = true;
        };
    }, [editingMember]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const hasIdentity =
            (inviteMode === 'user' && !!formData.userId) || (inviteMode === 'email' && !!formData.invitedEmail?.trim());
        if (!hasIdentity) return;

        setLoading(true);
        try {
            await onSubmit(formData);
        } finally {
            setLoading(false);
        }
    };

    const isSubmitDisabled =
        loading ||
        (inviteMode === 'user' && !formData.userId) ||
        (inviteMode === 'email' && !formData.invitedEmail?.trim());

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                {/* Invite mode toggle (only shown when creating a new invite) */}
                {!isEditing && (
                    <div className="flex rounded-md border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => {
                                setInviteMode('user');
                                setEmailInput('');
                                setFormData((prev) => ({ ...prev, userId: undefined, invitedEmail: undefined }));
                            }}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${
                                inviteMode === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-background text-muted-foreground hover:bg-muted'
                            }`}
                        >
                            Existing User
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setInviteMode('email');
                                setSelectedUser(null);
                                setFormData((prev) => ({ ...prev, userId: undefined, invitedEmail: '' }));
                            }}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${
                                inviteMode === 'email'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-background text-muted-foreground hover:bg-muted'
                            }`}
                        >
                            Email Invite
                        </button>
                    </div>
                )}

                {/* User selector or email input */}
                <div className="space-y-2">
                    {inviteMode === 'user' ? (
                        <>
                            <Label>User*</Label>
                            <OttaSelect
                                mode="single"
                                value={selectedUser}
                                onChange={(value) => {
                                    const nextUser = value as InvitableUserOption | null;
                                    setSelectedUser(nextUser);
                                    setFormData({
                                        ...formData,
                                        userId: nextUser?.id ?? undefined,
                                        invitedEmail: undefined,
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
                                    : "Search by name, email, or user ID. The user's account must already exist."}
                            </p>
                        </>
                    ) : (
                        <>
                            <Label htmlFor="invite-email">Email address*</Label>
                            <Input
                                id="invite-email"
                                type="email"
                                placeholder="member@example.com"
                                value={emailInput}
                                onChange={(e) => {
                                    setEmailInput(e.target.value);
                                    setFormData({ ...formData, invitedEmail: e.target.value, userId: undefined });
                                }}
                                disabled={isEditing || loading}
                                autoComplete="email"
                            />
                            <p className="text-sm text-muted-foreground">
                                {isEditing
                                    ? 'Email cannot be changed while editing.'
                                    : 'An invitation will be recorded. The user can join once they sign up with this email.'}
                            </p>
                        </>
                    )}
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

                {/* Status */}
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
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitDisabled}>
                    {loading ? (isEditing ? 'Saving...' : 'Inviting...') : isEditing ? 'Save Changes' : 'Invite Member'}
                </Button>
            </div>
        </form>
    );
}
