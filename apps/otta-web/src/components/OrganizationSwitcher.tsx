/**
 * Organization Switcher
 *
 * Dropdown to switch between organizations
 * GitHub-like minimal UI with dark mode support
 */

import { useOrganizations } from '@/hooks/useRBAC';
import { isPlatformAdmin, useSession } from '@/lib/auth';
import { PLATFORM_ORG_SENTINEL } from '@ottabase/config';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@ottabase/ui-shadcn';
import { useNavigate } from '@tanstack/react-router';
import { Building2, Check, ChevronsUpDown, Globe, Plus, Settings } from 'lucide-react';
import { useState } from 'react';

interface OrganizationSwitcherProps {
    currentOrgId?: string;
    onOrgChange?: (orgId: string) => void;
}

export function OrganizationSwitcher({ currentOrgId, onOrgChange }: OrganizationSwitcherProps) {
    const navigate = useNavigate();
    const { data: orgs = [], isLoading } = useOrganizations();
    const { user } = useSession();
    const [isOpen, setIsOpen] = useState(false);

    // Platform admins can act in PLATFORM scope (organizationId NULL server-side):
    // author/manage the platform's own blog and other platform-owned rows.
    const showPlatformScope = isPlatformAdmin(user);
    const inPlatformScope = currentOrgId === PLATFORM_ORG_SENTINEL;

    const currentOrg = orgs.find((org) => org.id === currentOrgId);
    const triggerLabel = inPlatformScope ? 'Platform' : currentOrg?.name || 'Select org...';

    const handleSelect = (orgId: string) => {
        if (onOrgChange) {
            onOrgChange(orgId);
        } else {
            // Default behavior: navigate to org page
            navigate({ to: `/admin/access/organizations/${orgId}/members` });
        }
        setIsOpen(false);
    };

    const handleCreateNew = () => {
        navigate({ to: '/admin/access/organizations/new' });
        setIsOpen(false);
    };

    const handleOpenSettings = (orgId: string) => {
        navigate({ to: `/admin/access/organizations/${orgId}/settings` });
        setIsOpen(false);
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
                <Button variant="outline" role="combobox" aria-expanded={isOpen} className="w-[200px] justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {inPlatformScope ? (
                            <Globe className="h-4 w-4 flex-shrink-0" />
                        ) : (
                            <Building2 className="h-4 w-4 flex-shrink-0" />
                        )}
                        <span className="text-sm truncate">{triggerLabel}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[240px]">
                {showPlatformScope && (
                    <>
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Platform</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => handleSelect(PLATFORM_ORG_SENTINEL)}
                            className="flex items-center gap-2 cursor-pointer"
                        >
                            <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <span className="truncate flex-1">Platform</span>
                            {inPlatformScope && <Check className="h-4 w-4 flex-shrink-0" />}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                )}
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
                                    handleOpenSettings(org.id);
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
