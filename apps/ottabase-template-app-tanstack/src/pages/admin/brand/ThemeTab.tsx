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
import { BUILTIN_THEME_NAMES } from '@ottabase/brand-engine/themes';
import { getThemeOrDefault } from '@ottabase/brand-engine';
import { GOOGLE_FONTS, fontToTypography } from '@ottabase/brand-engine/fonts';
import { IconPalette, IconStack2, IconTypography, IconWand } from '@tabler/icons-react';
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
    const [themePresetId, setThemePresetId] = useState<string | null>(null);
    const [fontHeading, setFontHeading] = useState<string>('Inter');
    const [fontBody, setFontBody] = useState<string>('Inter');
    const [fontHandwriting, setFontHandwriting] = useState<string>('Caveat');
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
            setThemePresetId((rawSettings.themePresetId as string | null) ?? null);
            setDefaultColorScheme((rawSettings.defaultColorScheme as 'light' | 'dark' | 'system') ?? 'system');
            setAllowDarkModeToggle(rawSettings.allowDarkModeToggle ?? true);
            try {
                const t = JSON.parse(rawSettings.tokensJson ?? '{}') as {
                    typography?: {
                        heading?: { fontFamily?: string };
                        body?: { fontFamily?: string };
                        handwriting?: { fontFamily?: string };
                    };
                };
                const presetTypo = getThemeOrDefault(rawSettings.themePresetId || 'default').tokens?.typography;
                const heading = t?.typography?.heading?.fontFamily ?? presetTypo?.heading?.fontFamily ?? 'Inter';
                const body = t?.typography?.body?.fontFamily ?? presetTypo?.body?.fontFamily ?? 'Inter';
                const handwriting =
                    t?.typography?.handwriting?.fontFamily ?? presetTypo?.handwriting?.fontFamily ?? 'Caveat';
                setFontHeading(heading);
                setFontBody(body);
                setFontHandwriting(handwriting);
            } catch {
                /* ignore */
            }
        }
    }, [rawSettings]);

    const applyFontOverride = (role: 'heading' | 'body' | 'handwriting', fontFamily: string) => {
        try {
            const t = JSON.parse(tokensJson || '{}') as Record<string, unknown>;
            t.typography = t.typography || {};
            const typo = t.typography as Record<string, { fontFamily: string; url?: string }>;
            typo[role] = fontToTypography(fontFamily, role);
            setTokensJson(JSON.stringify(t, null, 2));
        } catch {
            setTokensJson(JSON.stringify({ typography: { [role]: fontToTypography(fontFamily, role) } }, null, 2));
        }
    };

    const handleFontChange = (role: 'heading' | 'body' | 'handwriting', fontFamily: string) => {
        if (role === 'heading') setFontHeading(fontFamily);
        else if (role === 'body') setFontBody(fontFamily);
        else setFontHandwriting(fontFamily);
        applyFontOverride(role, fontFamily);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await brandApi.updateSettings({
                tokensJson: tokensJson.trim() ? tokensJson : undefined,
                themePresetId: themePresetId ?? undefined,
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
                            <CardTitle>Color preset</CardTitle>
                            <CardDescription>
                                Choose a base theme. Tokens below override on top. Theme is app-level – users only
                                switch light/dark.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Select
                                value={themePresetId ?? 'default'}
                                onValueChange={(v) => setThemePresetId(v === 'default' ? null : v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select preset" />
                                </SelectTrigger>
                                <SelectContent>
                                    {BUILTIN_THEME_NAMES.map((name) => (
                                        <SelectItem key={name} value={name}>
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <IconTypography className="h-5 w-5" />
                                Fonts
                            </CardTitle>
                            <CardDescription>
                                Select Google Fonts for heading, body, and handwriting. Same categories as built-in
                                themes.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Heading</label>
                                <Select value={fontHeading} onValueChange={(v) => handleFontChange('heading', v)}>
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[
                                            ...GOOGLE_FONTS.filter((f) =>
                                                ['sans-serif', 'serif', 'display'].includes(f.category),
                                            ),
                                            ...(GOOGLE_FONTS.some((f) => f.family === fontHeading)
                                                ? []
                                                : [
                                                      {
                                                          family: fontHeading,
                                                          category: 'sans-serif' as const,
                                                          weights: [400, 600, 700],
                                                      },
                                                  ]),
                                        ].map((f) => (
                                            <SelectItem key={f.family} value={f.family}>
                                                {f.family}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Body</label>
                                <Select value={fontBody} onValueChange={(v) => handleFontChange('body', v)}>
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[
                                            ...GOOGLE_FONTS.filter((f) => ['sans-serif', 'serif'].includes(f.category)),
                                            ...(GOOGLE_FONTS.some((f) => f.family === fontBody)
                                                ? []
                                                : [
                                                      {
                                                          family: fontBody,
                                                          category: 'sans-serif' as const,
                                                          weights: [400, 500, 600],
                                                      },
                                                  ]),
                                        ].map((f) => (
                                            <SelectItem key={f.family} value={f.family}>
                                                {f.family}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Handwriting</label>
                                <Select
                                    value={fontHandwriting}
                                    onValueChange={(v) => handleFontChange('handwriting', v)}
                                >
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[
                                            ...GOOGLE_FONTS.filter((f) => f.category === 'handwriting'),
                                            ...(GOOGLE_FONTS.some((f) => f.family === fontHandwriting)
                                                ? []
                                                : [
                                                      {
                                                          family: fontHandwriting,
                                                          category: 'handwriting' as const,
                                                          weights: [400, 700],
                                                      },
                                                  ]),
                                        ].map((f) => (
                                            <SelectItem key={f.family} value={f.family}>
                                                {f.family}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Design tokens (colors, typography, cursors)</CardTitle>
                            <CardDescription>
                                Overrides for colors (HSL), typography (fontFamily, url), spacing, cursors. Merged on
                                top of preset.
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
