import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Switch,
} from '@ottabase/ui-shadcn';
import { toast } from 'sonner';
import type { BrandSettingsResponse } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';
import { brandApi } from './brandApi';
import { LogoUploader } from './LogoUploader';

export function BrandSettingsTab() {
    const { config, isLoading: configLoading, refresh } = useBrand();
    const [saving, setSaving] = useState(false);
    const [brandName, setBrandName] = useState('');
    const [tagline, setTagline] = useState('');
    const [customCss, setCustomCss] = useState('');
    const [hideOttabaseBranding, setHideOttabaseBranding] = useState(false);
    const [tokensJson, setTokensJson] = useState('{}');
    const [defaultColorScheme, setDefaultColorScheme] = useState<'light' | 'dark' | 'system'>('system');
    const [allowDarkModeToggle, setAllowDarkModeToggle] = useState(true);

    const { data: rawSettings } = useQuery<BrandSettingsResponse>({
        queryKey: ['brand', 'settings'],
        queryFn: () => brandApi.getSettings() as Promise<BrandSettingsResponse>,
        enabled: !!config,
    });

    useEffect(() => {
        if (config) {
            setBrandName(config.brandName ?? '');
            setTagline(config.tagline ?? '');
            setCustomCss(config.customCss ?? '');
            setHideOttabaseBranding(config.hideOttabaseBranding ?? false);
            setDefaultColorScheme(config.defaultColorScheme ?? 'system');
            setAllowDarkModeToggle(config.allowDarkModeToggle ?? true);
        }
    }, [config]);

    useEffect(() => {
        if (rawSettings) {
            setTokensJson(rawSettings.tokensJson ?? '{}');
            setDefaultColorScheme((rawSettings.defaultColorScheme as 'light' | 'dark' | 'system') ?? 'system');
            setAllowDarkModeToggle(rawSettings.allowDarkModeToggle ?? true);
        }
    }, [rawSettings]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await brandApi.updateSettings({
                brandName: brandName || 'My App',
                tagline: tagline || undefined,
                customCss: customCss || undefined,
                hideOttabaseBranding,
                tokensJson: tokensJson.trim() ? tokensJson : undefined,
                defaultColorScheme,
                allowDarkModeToggle,
            });
            toast.success('Brand settings saved');
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
                <p className="text-muted-foreground">Loading brand config...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Tabs defaultValue="identity" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="identity">Identity</TabsTrigger>
                    <TabsTrigger value="logos">Logos</TabsTrigger>
                    <TabsTrigger value="tokens">Tokens</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                <TabsContent value="identity">
                    <Card>
                        <CardHeader>
                            <CardTitle>Brand identity</CardTitle>
                            <CardDescription>Display name and tagline shown across the app.</CardDescription>
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
                            <div>
                                <Label>Default color scheme</Label>
                                <Select
                                    value={defaultColorScheme}
                                    onValueChange={(v) => setDefaultColorScheme(v as 'light' | 'dark' | 'system')}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">Light</SelectItem>
                                        <SelectItem value="dark">Dark</SelectItem>
                                        <SelectItem value="system">System</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Allow dark mode toggle</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Let users switch light/dark in the app.
                                    </p>
                                </div>
                                <Switch checked={allowDarkModeToggle} onCheckedChange={setAllowDarkModeToggle} />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="logos">
                    {(config.logos?.icon ?? config.logos?.primary) && (
                        <div className="mb-4 rounded-lg border p-3">
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
                </TabsContent>

                <TabsContent value="tokens">
                    <Card>
                        <CardHeader>
                            <CardTitle>Design tokens</CardTitle>
                            <CardDescription>
                                JSON overrides for colors, typography, spacing. Merges with defaults. Use HSL format for
                                colors.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <textarea
                                className="w-full min-h-[200px] rounded-md border bg-background px-3 py-2 font-mono text-sm"
                                value={tokensJson}
                                onChange={(e) => setTokensJson(e.target.value)}
                                placeholder='{"color":{"light":{"primary":"221.2 83.2% 53.3%"}}}'
                                spellCheck={false}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="advanced">
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
                                    className="mt-2 w-full min-h-[120px] rounded-md border bg-background px-3 py-2 font-mono text-sm"
                                    value={customCss}
                                    onChange={(e) => setCustomCss(e.target.value)}
                                    placeholder=":root { --custom-var: value; }"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Hide Ottabase branding</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Remove "Powered by Ottabase" footer.
                                    </p>
                                </div>
                                <Switch checked={hideOttabaseBranding} onCheckedChange={setHideOttabaseBranding} />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save settings'}
                </Button>
            </div>
        </div>
    );
}
