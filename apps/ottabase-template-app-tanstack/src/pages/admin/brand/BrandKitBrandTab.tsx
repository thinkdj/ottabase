import { IconGitBranch, IconX } from '@tabler/icons-react';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ottabase/ui-shadcn';
import { brandKitApi, type BrandKitItem } from './brandApi';

interface BrandKitBrandTabProps {
    name: string;
    brandName: string;
    tagline: string;
    parentBrandKitId: string | null;
    currentKitId?: string;
    onChange: (data: { name?: string; brandName?: string; tagline?: string; parentBrandKitId?: string | null }) => void;
    /** When true, name field is read-only (system default kit) */
    nameReadOnly?: boolean;
}

export function BrandKitBrandTab({
    name,
    brandName,
    tagline,
    parentBrandKitId,
    currentKitId,
    onChange,
    nameReadOnly,
}: BrandKitBrandTabProps) {
    const { data: allKits } = useApiQuery<BrandKitItem[]>({
        entity: 'brand_kits',
        queryKey: ['list'],
        endpoint: '/api/brand/kits',
    });
    const availableParents = (allKits ?? []).filter((k) => k.id !== currentKitId);

    const parentKit = availableParents.find((k) => k.id === parentBrandKitId);

    return (
        <div className="space-y-4">
            {/* Inheritance picker */}
            <div className="rounded-lg border border-dashed p-4 space-y-2">
                <div className="flex items-center gap-2">
                    <IconGitBranch className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Inherits from</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                    Optionally inherit tokens (colors, fonts, spacing) from a parent Brand Kit. This kit's own values
                    override the parent's. Great for creating variations (e.g. seasonal themes, sub-brands).
                </p>
                <div className="flex items-center gap-2">
                    <Select
                        value={parentBrandKitId ?? '__none__'}
                        onValueChange={(v) => onChange({ parentBrandKitId: v === '__none__' ? null : v })}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="None (standalone)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">
                                <span className="text-muted-foreground">None (standalone)</span>
                            </SelectItem>
                            {availableParents.map((k) => (
                                <SelectItem key={k.id} value={k.id}>
                                    <span className="flex items-center gap-2">
                                        {k.name}
                                        {k.isDefault && (
                                            <span className="text-[10px] rounded bg-muted px-1 py-0.5 text-muted-foreground">
                                                default
                                            </span>
                                        )}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {parentBrandKitId && (
                        <button
                            type="button"
                            className="inline-flex items-center rounded-md border border-input p-2 text-muted-foreground hover:text-foreground hover:bg-accent"
                            onClick={() => onChange({ parentBrandKitId: null })}
                            title="Remove parent (make standalone)"
                        >
                            <IconX className="h-4 w-4" />
                        </button>
                    )}
                </div>
                {parentKit && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                        Inheriting from <strong>{parentKit.name}</strong> &mdash; values you set here will override the
                        parent.
                    </p>
                )}
            </div>

            <div>
                <Label htmlFor="kitName">Kit name</Label>
                <p className="text-xs text-muted-foreground mb-1">
                    {nameReadOnly
                        ? 'System default – name cannot be changed'
                        : 'Display name for this Brand Kit (e.g. Acme, Acme - Christmas)'}
                </p>
                <Input
                    id="kitName"
                    value={name}
                    onChange={(e) => onChange({ name: e.target.value })}
                    placeholder="e.g. Marketing, Acme - Christmas"
                    readOnly={nameReadOnly}
                    disabled={nameReadOnly}
                    className={nameReadOnly ? 'bg-muted' : ''}
                />
            </div>
            <div>
                <Label htmlFor="brandName">Brand name</Label>
                <p className="text-xs text-muted-foreground mb-1">Shown in header, emails, meta tags</p>
                <Input
                    id="brandName"
                    value={brandName}
                    onChange={(e) => onChange({ brandName: e.target.value })}
                    placeholder="My App"
                />
            </div>
            <div>
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                    id="tagline"
                    value={tagline}
                    onChange={(e) => onChange({ tagline: e.target.value })}
                    placeholder="Optional slogan"
                />
            </div>
        </div>
    );
}
