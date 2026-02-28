/**
 * Organization Registration Page
 *
 * First-time org creation for new users
 * Minimal, GitHub-like UI with dark mode support
 */

import { useCreateOrganization } from '@/hooks/useRBAC';
import { useRBACToast } from '@/hooks/useToast';
import { slugFromName } from '@/lib/slug';
import { organizationIdAtom } from '@/ottabase/state/appState';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@ottabase/ui-shadcn';
import { useNavigate } from '@tanstack/react-router';
import { useSetAtom } from 'jotai';
import { Building2, Loader2 } from 'lucide-react';
import { useState } from 'react';

const CURRENT_ORG_KEY = 'ottabase.current-org-id';

export function OrganizationRegistrationPage() {
    const navigate = useNavigate();
    const toast = useRBACToast();
    const createMutation = useCreateOrganization();
    const setOrganizationId = useSetAtom(organizationIdAtom);

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        plan: 'free' as 'free' | 'pro' | 'enterprise',
        status: 'active' as 'active' | 'suspended' | 'deleted',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));

        // Clear error
        if (errors[field]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const handleNameBlur = () => {
        setFormData((prev) => {
            if (prev.slug.trim()) return prev;
            return { ...prev, slug: slugFromName(prev.name) };
        });
    };

    const applyCurrentOrganization = (orgId: string) => {
        setOrganizationId(orgId);
        try {
            localStorage.setItem(CURRENT_ORG_KEY, orgId);
        } catch {
            // ignore storage failures
        }
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Organization name is required';
        } else if (formData.name.length < 2) {
            newErrors.name = 'Name must be at least 2 characters';
        }

        if (!formData.slug.trim()) {
            newErrors.slug = 'Slug is required';
        } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
            newErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
        } else if (formData.slug.length < 2) {
            newErrors.slug = 'Slug must be at least 2 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        createMutation.mutate(formData, {
            onSuccess: (org) => {
                toast.rbac.organizationCreated();
                if (org?.id) {
                    applyCurrentOrganization(org.id);
                    navigate({ to: `/organizations/${org.id}/members` });
                    return;
                }

                toast.warning('Organization created', 'Could not resolve organization id for redirect.');
                navigate({ to: '/organizations' });
            },
            onError: (error) => {
                toast.error('Failed to create organization', error instanceof Error ? error.message : 'Unknown error');
            },
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">Create Organization</CardTitle>
                    <CardDescription>Set up your organization to get started</CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {/* Organization Name */}
                        <div className="space-y-2">
                            <Label htmlFor="name">
                                Organization Name
                                <span className="text-destructive ml-1">*</span>
                            </Label>
                            <Input
                                id="name"
                                placeholder="Acme Inc"
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                onBlur={handleNameBlur}
                                disabled={createMutation.isPending}
                                className={errors.name ? 'border-destructive' : ''}
                            />
                            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                        </div>

                        {/* Slug */}
                        <div className="space-y-2">
                            <Label htmlFor="slug">
                                URL Slug
                                <span className="text-destructive ml-1">*</span>
                            </Label>
                            <Input
                                id="slug"
                                placeholder="acme-inc"
                                value={formData.slug}
                                onChange={(e) => handleChange('slug', e.target.value)}
                                disabled={createMutation.isPending}
                                className={errors.slug ? 'border-destructive' : ''}
                            />
                            {formData.slug && !errors.slug && (
                                <p className="text-sm text-muted-foreground">
                                    Your organization URL: /org/{formData.slug}
                                </p>
                            )}
                            {errors.slug && <p className="text-sm text-destructive">{errors.slug}</p>}
                        </div>

                        {/* Plan */}
                        <div className="space-y-2">
                            <Label htmlFor="plan">Plan</Label>
                            <Select
                                value={formData.plan}
                                onValueChange={(value) => handleChange('plan', value)}
                                disabled={createMutation.isPending}
                            >
                                <SelectTrigger id="plan">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="free">
                                        <div className="flex items-center gap-2">
                                            <span>Free</span>
                                            <span className="text-xs text-muted-foreground">Up to 3 users</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="pro">
                                        <div className="flex items-center gap-2">
                                            <span>Pro</span>
                                            <span className="text-xs text-muted-foreground">Up to 50 users</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="enterprise">
                                        <div className="flex items-center gap-2">
                                            <span>Enterprise</span>
                                            <span className="text-xs text-muted-foreground">Unlimited</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-2">
                        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                            {createMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Organization'
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full"
                            onClick={() => navigate({ to: '/organizations' })}
                            disabled={createMutation.isPending}
                        >
                            Cancel
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
