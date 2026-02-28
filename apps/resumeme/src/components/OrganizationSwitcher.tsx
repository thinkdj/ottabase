/**
 * Organization Switcher
 *
 * Dropdown to switch between organizations
 * GitHub-like minimal UI with dark mode support
 */

import { useOrganizations } from '@/hooks/useRBAC';
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
import { Building2, Check, ChevronsUpDown, Plus, Settings } from 'lucide-react';
import { useState } from 'react';

interface OrganizationSwitcherProps {
    currentOrgId?: string;
    onOrgChange?: (orgId: string) => void;
}

export function OrganizationSwitcher({ currentOrgId, onOrgChange }: OrganizationSwitcherProps) {
    const navigate = useNavigate();
    const { data: orgs = [], isLoading } = useOrganizations();
    const [isOpen, setIsOpen] = useState(false);

    const currentOrg = orgs.find((org) => org.id === currentOrgId);

    const handleSelect = (orgId: string) => {
        if (onOrgChange) {
            onOrgChange(orgId);
        } else {
            // Default behavior: navigate to org page
            navigate({ to: `/organizations/${orgId}/members` });
        }
        setIsOpen(false);
    };

    const handleCreateNew = () => {
        navigate({ to: '/organizations/new' });
        setIsOpen(false);
    };

    const handleOpenSettings = (orgId: string) => {
        navigate({ to: `/organizations/${orgId}/settings` });
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
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm truncate">{currentOrg?.name || 'Select org...'}</span>
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
