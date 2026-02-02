import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ottabase/ui-shadcn';
import type { MemberRole, MemberStatus } from '@/types/rbac';
import { useState } from 'react';

export interface InviteMemberFormProps {
    organizationId: string;
    onSubmit: (data: InviteMemberFormData) => Promise<void>;
    onCancel: () => void;
}

export interface InviteMemberFormData {
    userId: string;
    role: MemberRole;
    status: MemberStatus;
}

export function InviteMemberForm({ organizationId, onSubmit, onCancel }: InviteMemberFormProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<InviteMemberFormData>({
        userId: '',
        role: 'member',
        status: 'invited',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
                {/* User ID */}
                <div className="space-y-2">
                    <Label htmlFor="userId">User ID*</Label>
                    <Input
                        id="userId"
                        value={formData.userId}
                        onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                        placeholder="user-123"
                        required
                    />
                    <p className="text-sm text-muted-foreground">
                        The user ID to invite to this organization
                    </p>
                </div>

                {/* Role */}
                <div className="space-y-2">
                    <Label htmlFor="role">Role*</Label>
                    <Select value={formData.role} onValueChange={(value: 'owner' | 'admin' | 'member') => setFormData({ ...formData, role: value })}>
                        <SelectTrigger id="role">
                            <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                        Owner: Full control | Admin: Manage members | Member: Basic access
                    </p>
                </div>

                {/* Status */}
                <div className="space-y-2">
                    <Label htmlFor="status">Status*</Label>
                    <Select value={formData.status} onValueChange={(value: 'active' | 'invited' | 'suspended') => setFormData({ ...formData, status: value })}>
                        <SelectTrigger id="status">
                            <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="invited">Invited</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                        Active: Full access | Invited: Pending acceptance | Suspended: Access revoked
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? 'Inviting...' : 'Invite Member'}
                </Button>
            </div>
        </form>
    );
}
