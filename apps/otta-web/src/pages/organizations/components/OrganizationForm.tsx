import { slugFromName } from '@/lib/slug';
import type { OrganizationPlan, OrganizationSettings, OrganizationStatus } from '@/types/rbac';
import type { Organization } from '@ottabase/ottaorm';
import {
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

export interface OrganizationFormProps {
    organization?: Organization | null;
    onSubmit: (data: OrganizationFormData) => Promise<void>;
    onCancel: () => void;
}

export interface OrganizationFormData {
    name: string;
    slug: string;
    plan: OrganizationPlan;
    status: OrganizationStatus;
    settings?: OrganizationSettings;
    metadata?: Record<string, unknown>;
}

export function OrganizationForm({ organization, onSubmit, onCancel }: OrganizationFormProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<OrganizationFormData>({
        name: '',
        slug: '',
        plan: 'free',
        status: 'active',
        settings: {},
        metadata: {},
    });

    useEffect(() => {
        if (organization) {
            setFormData({
                name: organization.name || '',
                slug: organization.slug || '',
                plan: (organization.plan as 'free' | 'pro' | 'enterprise') || 'free',
                status: (organization.status as 'active' | 'suspended' | 'deleted') || 'active',
                settings: typeof organization.settings === 'object' ? organization.settings : {},
                metadata: typeof organization.metadata === 'object' ? organization.metadata : {},
            });
        }
    }, [organization]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit(formData);
        } finally {
            setLoading(false);
        }
    };

    const handleNameChange = (name: string) => {
        setFormData((prev) => ({
            ...prev,
            name,
            slug: organization ? prev.slug : slugFromName(name),
        }));
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                {/* Name */}
                <div className="space-y-2">
                    <Label htmlFor="name">Organization Name*</Label>
                    <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Acme Corporation"
                        required
                        minLength={2}
                        maxLength={100}
                    />
                    <p className="text-sm text-muted-foreground">
                        The display name of your organization (2-100 characters)
                    </p>
                </div>

                {/* Slug */}
                <div className="space-y-2">
                    <Label htmlFor="slug">Slug*</Label>
                    <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        placeholder="acme-corp"
                        required
                        pattern="[a-z0-9-]+"
                        minLength={2}
                        maxLength={100}
                        disabled={!!organization} // Don't allow editing slug after creation
                    />
                    <p className="text-sm text-muted-foreground">
                        {organization
                            ? 'Slug cannot be changed after creation'
                            : 'URL-friendly identifier (lowercase, numbers, hyphens only)'}
                    </p>
                </div>

                {/* Plan */}
                <div className="space-y-2">
                    <Label htmlFor="plan">Plan*</Label>
                    <Select
                        value={formData.plan}
                        onValueChange={(value: 'free' | 'pro' | 'enterprise') =>
                            setFormData({ ...formData, plan: value })
                        }
                    >
                        <SelectTrigger id="plan">
                            <SelectValue placeholder="Select plan" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Status */}
                <div className="space-y-2">
                    <Label htmlFor="status">Status*</Label>
                    <Select
                        value={formData.status}
                        onValueChange={(value: 'active' | 'suspended' | 'deleted') =>
                            setFormData({ ...formData, status: value })
                        }
                    >
                        <SelectTrigger id="status">
                            <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                            <SelectItem value="deleted">Deleted</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Max Members (Settings) */}
                <div className="space-y-2">
                    <Label htmlFor="maxMembers">Max Members</Label>
                    <Input
                        id="maxMembers"
                        type="number"
                        value={formData.settings?.maxMembers || ''}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                settings: { ...formData.settings, maxMembers: parseInt(e.target.value) || undefined },
                            })
                        }
                        placeholder="50"
                        min={1}
                        max={10000}
                    />
                    <p className="text-sm text-muted-foreground">
                        Maximum number of members (leave empty for unlimited)
                    </p>
                </div>

                {/* Features (Settings) */}
                <div className="space-y-2">
                    <Label htmlFor="features">Features (comma-separated)</Label>
                    <Input
                        id="features"
                        value={formData.settings?.features?.join(', ') || ''}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                settings: {
                                    ...formData.settings,
                                    features: e.target.value
                                        .split(',')
                                        .map((f) => f.trim())
                                        .filter(Boolean),
                                },
                            })
                        }
                        placeholder="rbac, audit, api"
                    />
                    <p className="text-sm text-muted-foreground">Comma-separated list of enabled features</p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : organization ? 'Update Organization' : 'Create Organization'}
                </Button>
            </div>
        </form>
    );
}
