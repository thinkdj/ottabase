/**
 * Organization Switcher
 *
 * Dropdown to switch between organizations
 * GitHub-like minimal UI with dark mode support
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Badge,
} from '@ottabase/ui-shadcn';
import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useOrganizations } from '@/hooks/useRBAC';

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
            <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleCreateNew}
            >
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
                    className="w-[200px] justify-between"
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm truncate">
                            {currentOrg?.name || 'Select org...'}
                        </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Your Organizations
                </DropdownMenuLabel>
                {orgs.map((org) => (
                    <DropdownMenuItem
                        key={org.id}
                        onClick={() => handleSelect(org.id)}
                        className="flex items-center justify-between cursor-pointer"
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <span className="truncate">{org.name}</span>
                        </div>
                        {currentOrgId === org.id && (
                            <Check className="h-4 w-4 flex-shrink-0" />
                        )}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={handleCreateNew}
                    className="cursor-pointer"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Create Organization</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
