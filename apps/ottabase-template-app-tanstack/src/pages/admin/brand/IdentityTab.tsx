import { useState, useEffect } from 'react';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Switch,
} from '@ottabase/ui-shadcn';
import { toast } from 'sonner';
import { useBrand } from '@ottabase/brand-engine-react';
import { brandApi } from './brandApi';
import { LogoUploader } from './LogoUploader';

// ---------------------------------------------------------------------------
// Identity – Brand name, tagline, logos. Once per app.
// ---------------------------------------------------------------------------

export function IdentityTab() {
    const { config, isLoading: configLoading, refresh } = useBrand();
    const [saving, setSaving] = useState(false);
    const [brandName, setBrandName] = useState('');
    const [tagline, setTagline] = useState('');
    const [customCss, setCustomCss] = useState('');
    const [hideOttabaseBranding, setHideOttabaseBranding] = useState(false);

    useEffect(() => {
        if (config) {
            setBrandName(config.brandName ?? '');
            setTagline(config.tagline ?? '');
            setCustomCss(config.customCss ?? '');
            setHideOttabaseBranding(config.hideOttabaseBranding ?? false);
        }
    }, [config]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await brandApi.updateSettings({
                brandName: brandName || 'My App',
                tagline: tagline || undefined,
                customCss: customCss || undefined,
                hideOttabaseBranding,
            });
            toast.success('Identity saved');
            refresh();
        } catch {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (configLoading || !config) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Brand identity</CardTitle>
                    <CardDescription>
                        Name and tagline shown in the header, emails, and meta tags. Configure once per app.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="brandName">Brand name</Label>
                        <Input
                            id="brandName"
                            value={brandName}
                            onChange={(e) => setBrandName(e.target.value)}
                            placeholder="My App"
                        />
                    </div>
                    <div>
                        <Label htmlFor="tagline">Tagline</Label>
                        <Input
                            id="tagline"
                            value={tagline}
                            onChange={(e) => setTagline(e.target.value)}
                            placeholder="Optional slogan"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Logos</CardTitle>
                    <CardDescription>
                        Primary logo, dark-mode variant, favicon, social share image, and email header. One set per app.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {(config.logos?.icon ?? config.logos?.primary) && (
                        <div className="mb-4 rounded-lg border p-3 dark:border-muted">
                            <p className="text-xs text-muted-foreground mb-2">Favicon (icon used as /favicon)</p>
                            <img
                                src={config.logos?.icon ?? config.logos?.primary ?? ''}
                                alt="Favicon preview"
                                className="h-8 w-8 object-contain"
                            />
                        </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <LogoUploader logoType="logo" currentUrl={config.logos?.primary} onUploaded={() => refresh()} />
                        <LogoUploader
                            logoType="logo-dark"
                            currentUrl={config.logos?.dark}
                            onUploaded={() => refresh()}
                        />
                        <LogoUploader logoType="icon" currentUrl={config.logos?.icon} onUploaded={() => refresh()} />
                        <LogoUploader
                            logoType="og-image"
                            currentUrl={config.logos?.ogImage}
                            onUploaded={() => refresh()}
                        />
                        <LogoUploader
                            logoType="email-logo"
                            currentUrl={config.logos?.emailLogo}
                            onUploaded={() => refresh()}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Advanced</CardTitle>
                    <CardDescription>Custom CSS and white-label options.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="customCss">Custom CSS</Label>
                        <textarea
                            id="customCss"
                            className="mt-2 w-full min-h-[120px] rounded-md border bg-background px-3 py-2 font-mono text-sm dark:border-muted"
                            value={customCss}
                            onChange={(e) => setCustomCss(e.target.value)}
                            placeholder=":root { --custom-var: value; }"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Hide Ottabase branding</Label>
                            <p className="text-xs text-muted-foreground">
                                Remove &quot;Powered by Ottabase&quot; footer.
                            </p>
                        </div>
                        <Switch checked={hideOttabaseBranding} onCheckedChange={setHideOttabaseBranding} />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save identity'}
                </Button>
            </div>
        </div>
    );
}
