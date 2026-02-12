import { Input, Label } from '@ottabase/ui-shadcn';

interface BrandKitBrandTabProps {
    name: string;
    brandName: string;
    tagline: string;
    onChange: (data: { name?: string; brandName?: string; tagline?: string }) => void;
    /** When true, name field is read-only (system default kit) */
    nameReadOnly?: boolean;
}

export function BrandKitBrandTab({ name, brandName, tagline, onChange, nameReadOnly }: BrandKitBrandTabProps) {
    return (
        <div className="space-y-4">
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
