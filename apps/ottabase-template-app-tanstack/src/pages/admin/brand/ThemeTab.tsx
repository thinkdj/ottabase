import { useState, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@ottabase/ui-shadcn';
import { IconPalette, IconStack2, IconWand } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { BrandSettingsResponse } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';
import { brandApi } from './brandApi';
import { ThemeVariantEditorTab } from './ThemeVariantEditorTab';
import { ColorGeneratorTab } from './ColorGeneratorTab';

// ---------------------------------------------------------------------------
// Theme – Base look (once) + switchable variants + color generator
// ---------------------------------------------------------------------------

const VALID_SUBTABS = ['base', 'variants', 'generator'] as const;

export function ThemeTab() {
    const navigate = useNavigate();
    const search = useSearch({ strict: false }) as { subtab?: string };
    const subtab = VALID_SUBTABS.includes(search?.subtab as (typeof VALID_SUBTABS)[number])
        ? (search.subtab as (typeof VALID_SUBTABS)[number])
        : 'base';

    const { config, isLoading: configLoading, refresh } = useBrand();
    const [saving, setSaving] = useState(false);
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
                tokensJson: tokensJson.trim() ? tokensJson : undefined,
                defaultColorScheme,
                allowDarkModeToggle,
            });
            toast.success('Theme settings saved');
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

    const onSubtabChange = (v: string) => {
        navigate({ to: '/admin/brand-engine', search: { tab: 'theme', subtab: v } });
    };

    return (
        <div className="space-y-6">
            <Tabs value={subtab} onValueChange={onSubtabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
                    <TabsTrigger value="base">
                        <IconPalette className="h-4 w-4 mr-2" />
                        Base theme
                    </TabsTrigger>
                    <TabsTrigger value="variants">
                        <IconStack2 className="h-4 w-4 mr-2" />
                        Theme variants
                    </TabsTrigger>
                    <TabsTrigger value="generator">
                        <IconWand className="h-4 w-4 mr-2" />
                        Color generator
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="base" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Base design tokens</CardTitle>
                            <CardDescription>
                                Default colors, typography, and spacing. Applied across the app. Use HSL format for
                                colors.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <textarea
                                className="w-full min-h-[200px] rounded-md border bg-background px-3 py-2 font-mono text-sm dark:border-muted"
                                value={tokensJson}
                                onChange={(e) => setTokensJson(e.target.value)}
                                placeholder='{"color":{"light":{"primary":"221.2 83.2% 53.3%"}}}'
                                spellCheck={false}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Appearance</CardTitle>
                            <CardDescription>Default color scheme and dark mode toggle.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Default color scheme</label>
                                <Select
                                    value={defaultColorScheme}
                                    onValueChange={(v) => setDefaultColorScheme(v as 'light' | 'dark' | 'system')}
                                >
                                    <SelectTrigger className="mt-2">
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
                                    <label className="text-sm font-medium">Allow dark mode toggle</label>
                                    <p className="text-xs text-muted-foreground">
                                        Let users switch light/dark in the app.
                                    </p>
                                </div>
                                <Switch checked={allowDarkModeToggle} onCheckedChange={setAllowDarkModeToggle} />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : 'Save base theme'}
                        </Button>
                    </div>
                </TabsContent>

                <TabsContent value="variants">
                    <p className="text-sm text-muted-foreground mb-4">
                        Seasonal or A/B themes with custom tokens. Switch via URL (?themeVariant=id) or link to presets.
                    </p>
                    <ThemeVariantEditorTab />
                </TabsContent>

                <TabsContent value="generator">
                    <ColorGeneratorTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
