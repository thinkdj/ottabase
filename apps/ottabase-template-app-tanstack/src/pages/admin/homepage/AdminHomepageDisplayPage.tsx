/**
 * Admin Homepage Display Settings
 *
 * Manages the homepage display state: variant selection per slot,
 * theme preset, custom CSS, and SEO metadata.
 *
 * Single-row settings model (id = 'default'). Uses upsert semantics.
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { homepageDisplaySettingsHooks, type HomepageDisplaySettingsRow } from '@/hooks/homepageHooks';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Separator,
    Textarea,
} from '@ottabase/ui-shadcn';
import { Check, Code, Globe, Monitor, Palette, RotateCcw, Save, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { HomepageAdminNav } from './HomepageAdminNav';
import { getDefaultVariantBySlot, SLOT_CONFIG, SLOT_NAMES, THEME_PRESETS, type SlotName } from './homepage-constants';

export function AdminHomepageDisplayPage() {
    const { data, isLoading } = homepageDisplaySettingsHooks.useList({}, ADMIN_LIST_QUERY_CONFIG);
    const createSettings = homepageDisplaySettingsHooks.useCreate();
    const updateSettings = homepageDisplaySettingsHooks.useUpdate();

    // Normalize response: list may return array or paginated
    const rows = (Array.isArray(data) ? data : []) as HomepageDisplaySettingsRow[];
    const existing = rows.find((r) => r.id === 'default') ?? null;

    const [variantBySlot, setVariantBySlot] = useState<Record<string, string>>(getDefaultVariantBySlot());
    const [themePreset, setThemePreset] = useState('default');
    const [customCss, setCustomCss] = useState('');
    const [seoTitle, setSeoTitle] = useState('');
    const [seoDescription, setSeoDescription] = useState('');
    const [initialized, setInitialized] = useState(false);

    // Populate from DB when data loads
    useEffect(() => {
        if (existing && !initialized) {
            setVariantBySlot({ ...getDefaultVariantBySlot(), ...(existing.variantBySlotJson ?? {}) });
            setThemePreset(existing.themePreset ?? 'default');
            setCustomCss(existing.customCss ?? '');
            setSeoTitle(existing.seoTitle ?? '');
            setSeoDescription(existing.seoDescription ?? '');
            setInitialized(true);
        } else if (!isLoading && !existing && !initialized) {
            // No row yet — use defaults
            setInitialized(true);
        }
    }, [existing, isLoading, initialized]);

    const isDirty =
        initialized &&
        (JSON.stringify(variantBySlot) !==
            JSON.stringify({ ...getDefaultVariantBySlot(), ...(existing?.variantBySlotJson ?? {}) }) ||
            themePreset !== (existing?.themePreset ?? 'default') ||
            customCss !== (existing?.customCss ?? '') ||
            seoTitle !== (existing?.seoTitle ?? '') ||
            seoDescription !== (existing?.seoDescription ?? ''));

    const handleSave = useCallback(async () => {
        const payload = {
            variantBySlotJson: variantBySlot,
            themePreset,
            customCss: customCss || undefined,
            seoTitle: seoTitle || undefined,
            seoDescription: seoDescription || undefined,
        };
        if (existing) {
            await updateSettings.mutateAsync({ id: 'default', data: payload });
        } else {
            await createSettings.mutateAsync({ id: 'default', ...payload });
        }
    }, [existing, variantBySlot, themePreset, customCss, seoTitle, seoDescription, updateSettings, createSettings]);

    const handleVariantChange = (slot: SlotName, variantId: string) => {
        setVariantBySlot((prev) => ({ ...prev, [slot]: variantId }));
    };

    const handleResetDefaults = () => {
        setVariantBySlot(getDefaultVariantBySlot());
        setThemePreset('default');
        setCustomCss('');
        setSeoTitle('');
        setSeoDescription('');
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <HomepageAdminNav />
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">Loading display settings…</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <HomepageAdminNav />

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Display Settings</h1>
                    <p className="text-muted-foreground mt-1">
                        Configure layout variants, theme, SEO, and custom styling for the homepage.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleResetDefaults}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!isDirty || updateSettings.isPending || createSettings.isPending}
                    >
                        <Save className="mr-2 h-4 w-4" />
                        {updateSettings.isPending || createSettings.isPending ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </div>

            {/* Theme Preset */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        Theme Preset
                    </CardTitle>
                    <CardDescription>Select the visual theme for the homepage.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                        {THEME_PRESETS.map((preset) => {
                            const isActive = themePreset === preset.id;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => setThemePreset(preset.id)}
                                    className={`relative rounded-lg border-2 p-3 text-left transition-all ${
                                        isActive
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                            : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                                    }`}
                                >
                                    {isActive && (
                                        <div className="absolute top-2 right-2 rounded-full bg-primary p-0.5">
                                            <Check className="h-3 w-3 text-primary-foreground" />
                                        </div>
                                    )}
                                    <p className="font-medium text-sm">{preset.label}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{preset.description}</p>
                                </button>
                            );
                        })}
                    </div>
                    <Separator className="my-4" />
                    <div className="flex items-center gap-3">
                        <Label htmlFor="theme-preset-custom" className="shrink-0 text-sm">
                            Custom preset:
                        </Label>
                        <Input
                            id="theme-preset-custom"
                            value={themePreset}
                            onChange={(e) => setThemePreset(e.target.value)}
                            placeholder="default"
                            className="max-w-xs"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Slot Variant Pickers */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        Layout Variants
                    </CardTitle>
                    <CardDescription>Choose the display variant for each homepage slot.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {SLOT_NAMES.map((slot) => {
                        const config = SLOT_CONFIG[slot];
                        const selected = variantBySlot[slot] ?? config.default;

                        return (
                            <div key={slot}>
                                <div className="flex items-center gap-2 mb-3">
                                    <p className="text-sm font-medium">{config.label}</p>
                                    <Badge variant="outline" className="font-mono text-[10px]">
                                        {slot}
                                    </Badge>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    {config.variants.map((v) => {
                                        const isActive = selected === v.id;
                                        return (
                                            <button
                                                key={v.id}
                                                type="button"
                                                onClick={() => handleVariantChange(slot, v.id)}
                                                className={`relative rounded-lg border-2 p-3 text-left transition-all ${
                                                    isActive
                                                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                                        : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                                                }`}
                                            >
                                                {isActive && (
                                                    <div className="absolute top-2 right-2 rounded-full bg-primary p-0.5">
                                                        <Check className="h-3 w-3 text-primary-foreground" />
                                                    </div>
                                                )}
                                                <p className="font-medium text-sm">{v.label}</p>
                                                <p className="mt-0.5 text-xs text-muted-foreground">{v.desc}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                                {slot !== SLOT_NAMES[SLOT_NAMES.length - 1] && <Separator className="mt-4" />}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            {/* SEO Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        SEO
                    </CardTitle>
                    <CardDescription>Search engine optimization for the homepage.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="seo-title">Page Title</Label>
                        <Input
                            id="seo-title"
                            value={seoTitle}
                            onChange={(e) => setSeoTitle(e.target.value)}
                            placeholder="My Awesome Product — Tagline"
                            className="max-w-lg"
                        />
                        <p className="text-xs text-muted-foreground">
                            Appears in browser tab and search results. Recommended: 50–60 characters.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="seo-description">Meta Description</Label>
                        <Textarea
                            id="seo-description"
                            value={seoDescription}
                            onChange={(e) => setSeoDescription(e.target.value)}
                            placeholder="A brief description of your product or service for search engines."
                            rows={3}
                            className="max-w-lg"
                        />
                        <p className="text-xs text-muted-foreground">
                            Shown in search result snippets. Recommended: 150–160 characters.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Custom CSS */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Custom CSS
                    </CardTitle>
                    <CardDescription>
                        Inject custom CSS into the homepage. Use with care — overrides may break layout.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                        value={customCss}
                        onChange={(e) => setCustomCss(e.target.value)}
                        placeholder={`.hero-section {\n  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n}`}
                        rows={8}
                        className="font-mono text-sm"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
