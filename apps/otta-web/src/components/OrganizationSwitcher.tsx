/**
 * Organization Switcher
 *
 * Dropdown to switch between organizations. Current org is
 * derived from the session (single source of truth). Selecting
 * an org calls POST /api/account/switch-org which re-issues the
 * JWT, then refreshSession() pulls the new token + context.
 */

import { useAccessibleOrganizations } from '@/hooks/useRBAC';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@ottabase/ui-shadcn';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Building2, Check, ChevronsUpDown, Plus, Settings } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function OrganizationSwitcher() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user, refreshSession } = useSession();
    const { data: orgs = [], isLoading } = useAccessibleOrganizations();
    const [isOpen, setIsOpen] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);

    const currentOrgId = (user as any)?.organizationId ?? null;
    const currentOrg = orgs.find((org) => org.id === currentOrgId) ?? orgs[0];

    const switchOrganization = async (organizationId: string): Promise<boolean> => {
        setIsSwitching(true);
        try {
            await api('/api/account/switch-org', {
                method: 'POST',
                body: { organizationId },
            });
            await refreshSession();
            await queryClient.invalidateQueries({
                predicate: (query) =>
                    query.queryKey.some((key) => typeof key === 'string' && key.toLowerCase().includes('organization')),
            });
            return true;
        } catch (error) {
            toast.error(error instanceof Error && error.message ? error.message : 'Failed to switch organization');
            return false;
        } finally {
            setIsSwitching(false);
        }
    };

    const handleSelect = async (orgId: string) => {
        setIsOpen(false);
        if (orgId === currentOrgId) return;
        const ok = await switchOrganization(orgId);
        if (ok) {
            navigate({ to: '/admin/organization/members' });
        }
    };

    const handleCreateNew = () => {
        navigate({ to: '/onboarding/organization' });
        setIsOpen(false);
    };

    const handleOpenSettings = async (orgId: string) => {
        setIsOpen(false);
        if (orgId !== currentOrgId) {
            const ok = await switchOrganization(orgId);
            if (!ok) return;
        }
        navigate({ to: '/admin/organization/settings' });
    };

    if (isLoading) {
        return (
            <Button variant="outline" size="sm" disabled className="w-[200px] justify-between">
                <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="text-sm">Loading...</span>
                </div>
            </Button>
        );
    }

    if (orgs.length === 0) {
        return (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCreateNew}>
                <Plus className="h-4 w-4" />
                <span className="text-sm">Create Organization</span>
            </Button>
        );
    }

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isOpen}
                    disabled={isSwitching}
                    className="w-[200px] justify-between"
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm truncate">
                            {isSwitching ? 'Switching…' : currentOrg?.name || 'Select org...'}
                        </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[240px]">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Your Organizations</DropdownMenuLabel>
                {orgs.map((org) => (
                    <DropdownMenuItem
                        key={org.id}
                        onClick={() => handleSelect(org.id)}
                        className="flex items-center justify-between gap-2 cursor-pointer"
                    >
                        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                            <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <span className="truncate flex-1">{org.name}</span>
                            {currentOrgId === org.id && <Check className="h-4 w-4 flex-shrink-0" />}
                        </div>
                        <div className="ml-1 flex flex-shrink-0 items-center gap-1 border-l border-border/70 pl-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-sm border border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                                aria-label={`Open settings for ${org.name}`}
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void handleOpenSettings(org.id);
                                }}
                            >
                                <Settings className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCreateNew} className="cursor-pointer">
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Create Organization</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
