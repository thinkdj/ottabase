// ---------------------------------------------------------------------------
// Theme tab – Preset picker + color palette override (merged view)
// ---------------------------------------------------------------------------

import {
    DEFAULT_SHADOWS,
    DEFAULT_SPACING,
    generatePalette,
    generateSemanticDefaults,
    generateSemanticDefaultsDark,
    hexToHsl,
    PRESET_MAP,
    THEME_PRESET_ITEMS,
    type SemanticPalette,
} from '@ottabase/brand-engine';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { OttaSelect, type ItemRendererProps, type OttaSelectItem } from '@ottabase/ottaselect';
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
import { IconPalette, IconRefresh } from '@tabler/icons-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { expandPresetPreservingCursors } from './presetUtils';
import { OverrideSection } from './OverrideSection';

/** Convert HSL string "221 83% 53%" to CSS hsl() */
function hslToCss(hsl: string): string {
    const base = hsl.split('/')[0].trim();
    const parts = base
        .split(/\s+/)
        .map((v) => parseFloat(v))
        .filter((n) => !Number.isNaN(n));
    if (parts.length < 3) return 'hsl(221, 83%, 53%)';
    return `hsl(${parts[0]}, ${parts[1]}%, ${parts[2]}%)`;
}

/** Convert HSL channel string "221 83% 53%" to hex "#3b82f6" for color picker inputs */
function hslChannelsToHex(hsl: string): string {
    const parsed = parseHsl(hsl);
    if (!parsed) return '#000000';
    const { h, s, l: lVal } = parsed;
    const lNorm = lVal / 100;
    const a = (s * Math.min(lNorm, 1 - lNorm)) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color)
            .toString(16)
            .padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function parseHsl(hslStr: string) {
    const parts = hslStr
        .replace(/deg|%|,/g, '')
        .split(' ')
        .filter(Boolean)
        .map(Number);
    if (parts.length < 3) return null;
    return { h: parts[0], s: parts[1], l: parts[2] };
}

export interface BrandKitThemeTabProps {
    themePresetId: string | null;
    tokensJson: string;
    onThemePresetChange: (id: string | null) => void;
    onTokensChange: (tokensJson: string) => void;
    /** When true, wrap color section in an override toggle (inherited kit) */
    hasParent?: boolean;
}

/** Describes where each semantic token is typically used in the UI */
const TOKEN_USAGE: Record<string, string> = {
    background: 'Page & app background',
    foreground: 'Primary text color',
    primary: 'Buttons, links, active indicators',
    'primary-foreground': 'Text on primary-colored elements',
    secondary: 'Secondary buttons, tags, badges',
    'secondary-foreground': 'Text on secondary elements',
    muted: 'Disabled states, subtle backgrounds',
    'muted-foreground': 'Placeholder text, captions, hints',
    accent: 'Hover states, highlights, selections',
    'accent-foreground': 'Text on accent-colored surfaces',
    destructive: 'Delete buttons, error alerts, warnings',
    'destructive-foreground': 'Text on destructive elements',
    border: 'Card borders, dividers, separators',
    input: 'Input field borders & outlines',
    ring: 'Focus rings around interactive elements',
    card: 'Card & panel surface backgrounds',
    'card-foreground': 'Text inside cards & panels',
    popover: 'Dropdown & tooltip backgrounds',
    'popover-foreground': 'Text inside dropdowns & tooltips',
};

/**
 * Reusable color swatch – smooth edges (avoids jagged borders).
 * Uses inset box-shadow instead of border (renders cleaner on small elements),
 * and translateZ(0) to promote to GPU layer for better anti-aliasing.
 */
export const colorSwatchClass =
    'shrink-0 rounded shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] [transform:translateZ(0)]';

/** Custom renderer for theme preset items in OttaSelect dropdown (render function, not a component) */
const themePresetRenderer = ({ item }: ItemRendererProps) => (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <span className="truncate font-medium capitalize">{item.name}</span>
        <div className="flex gap-1 shrink-0">
            {((item.colors as string[]) ?? []).slice(0, 5).map((hsl, i) => (
                <div
                    key={i}
                    className={`w-5 h-5 ${colorSwatchClass}`}
                    style={{ backgroundColor: hslToCss(hsl) }}
                    title={hsl}
                />
            ))}
        </div>
    </div>
);

/** Renders a single editable token swatch with inline color picker */
const TokenSwatch = memo(function TokenSwatch({
    token,
    value,
    mode,
    onEdit,
}: {
    token: string;
    value: string;
    mode: 'light' | 'dark';
    onEdit: (mode: 'light' | 'dark', token: string, hex: string) => void;
}) {
    return (
        <div className="flex items-center gap-1.5 rounded-md border p-1.5 bg-card/50 dark:border-muted group">
            <label className="relative shrink-0 cursor-pointer">
                <div className={`h-7 w-7 ${colorSwatchClass}`} style={{ backgroundColor: hslToCss(value) }} />
                <input
                    type="color"
                    value={hslChannelsToHex(value)}
                    onChange={(e) => onEdit(mode, token, e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    title={`Edit ${token}`}
                />
            </label>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-medium leading-tight">{token.replace('-foreground', '-fg')}</p>
                <p className="truncate text-[9px] font-mono text-muted-foreground leading-tight">{value}</p>
            </div>
        </div>
    );
});

export function BrandKitThemeTab({
    themePresetId,
    tokensJson,
    onThemePresetChange,
    onTokensChange,
    hasParent,
}: BrandKitThemeTabProps) {
    // ── Preset picker state ──────────────────────────────────────────────
    // Fetch presets from API
    const { data: apiPresets } = useApiQuery<
        Array<{ name: string; colors: { light: Record<string, string>; dark: Record<string, string> } }>
    >({
        entity: 'brand_presets',
        queryKey: ['presets'],
        endpoint: '/api/brand/presets',
        queryOptions: { staleTime: Infinity }, // Presets are static
    });

    const themePresetItems = useMemo(() => {
        if (!apiPresets || apiPresets.length === 0) return THEME_PRESET_ITEMS;

        // Convert API presets to dropdown items
        return apiPresets.map((preset) => {
            const light = preset.colors.light;
            return {
                id: preset.name,
                name: preset.name.charAt(0).toUpperCase() + preset.name.slice(1),
                colors: [
                    light.primary || '221.2 83.2% 53.3%',
                    light.secondary || '210 40% 96.1%',
                    light.accent || '210 40% 96.1%',
                    light.muted || '210 40% 96.1%',
                    light.destructive || '0 84.2% 60.2%',
                ] as [string, string, string, string, string],
            };
        });
    }, [apiPresets]);

    const selectedId = themePresetId ?? 'default';
    const selectedItem = themePresetItems.find((t) => t.id === selectedId) ?? themePresetItems[0];

    // Get full preset data for color expansion
    const selectedPreset = apiPresets?.find((p) => p.name === selectedId);

    // Resolve the full color palette from tokensJson (contains expanded theme)
    const resolvedColors = useMemo(() => {
        try {
            const parsed = JSON.parse(tokensJson || '{}') as { color?: { light?: Record<string, string> } };
            if (parsed.color?.light) {
                return parsed.color.light;
            }
        } catch {}

        // Fallback to preset colors if no custom colors in tokensJson
        return selectedPreset?.colors.light || {};
    }, [tokensJson, selectedPreset]);

    // The semantic token keys we want to show, grouped for display
    const DISPLAY_TOKENS = [
        'background',
        'foreground',
        'primary',
        'primary-foreground',
        'secondary',
        'secondary-foreground',
        'muted',
        'muted-foreground',
        'accent',
        'accent-foreground',
        'destructive',
        'destructive-foreground',
        'border',
        'input',
        'ring',
        'card',
        'card-foreground',
        'popover',
        'popover-foreground',
    ] as const;

    // Generate 50-950 gradient from primary color
    const primaryGradient = useMemo(() => {
        const primary = resolvedColors?.primary;
        if (!primary) return null;
        const hsl = parseHsl(primary);
        if (!hsl) return null;
        return generatePalette(hsl.h, hsl.s, hsl.l);
    }, [resolvedColors?.primary]);

    const hasCustomColorOverrides = useMemo(() => {
        try {
            const parsed = JSON.parse(tokensJson || '{}') as {
                color?: { light?: Record<string, string>; dark?: Record<string, string> };
            };
            if (!parsed.color?.light) return false;
            const preset = selectedPreset ?? PRESET_MAP[selectedId];
            if (!preset?.colors) return !!parsed.color;
            // Custom override = colors differ from selected preset (restore replaces with preset, so no override)
            const tokensLight = parsed.color.light ?? {};
            const presetLight = preset.colors.light ?? {};
            const tokensDark = parsed.color.dark ?? {};
            const presetDark = preset.colors.dark ?? {};
            const allKeys = new Set([
                ...Object.keys(tokensLight),
                ...Object.keys(presetLight),
                ...Object.keys(tokensDark),
                ...Object.keys(presetDark),
            ]);
            for (const k of allKeys) {
                if (tokensLight[k] !== presetLight[k] || tokensDark[k] !== presetDark[k]) return true;
            }
            return false;
        } catch {
            return false;
        }
    }, [tokensJson, selectedPreset, selectedId]);

    // Resolved spacing, radius, shadow from tokensJson (with preset defaults)
    const { parsedSpacing, parsedRadius, parsedShadow } = useMemo(() => {
        try {
            const p = JSON.parse(tokensJson || '{}');
            return {
                parsedSpacing: p.spacing,
                parsedRadius: p.radius,
                parsedShadow: p.shadow,
            };
        } catch {
            return {};
        }
    }, [tokensJson]);

    const isSplitLayout = useMemo(() => {
        const hasLight = (v: any) =>
            v && typeof v === 'object' && ('light' in v || 'dark' in v) && !('xs' in v) && !('section' in v);
        return hasLight(parsedSpacing) || hasLight(parsedRadius) || hasLight(parsedShadow);
    }, [parsedSpacing, parsedRadius, parsedShadow]);

    const extractMode = (v: any, fallback: any) => {
        if (!v) return fallback;
        if (typeof v === 'object' && ('light' in v || 'dark' in v) && !('xs' in v) && !('section' in v)) {
            return { ...fallback, ...(v.light || {}) };
        }
        return { ...fallback, ...v };
    };

    const resolvedSpacing = useMemo(() => extractMode(parsedSpacing, DEFAULT_SPACING), [parsedSpacing]);
    const resolvedRadius = useMemo(() => {
        if (!parsedRadius) return '0.5rem';
        if (typeof parsedRadius === 'object' && ('light' in parsedRadius || 'dark' in parsedRadius))
            return parsedRadius.light || '0.5rem';
        return parsedRadius as string;
    }, [parsedRadius]);
    const resolvedShadows = useMemo(() => extractMode(parsedShadow, DEFAULT_SHADOWS), [parsedShadow]);

    const hasSpacingRadiusShadowOverrides = !!(parsedSpacing || parsedRadius || parsedShadow);

    const handleRestorePresetColors = () => {
        try {
            const parsed = JSON.parse(tokensJson || '{}') as Record<string, unknown>;
            // Restore to currently selected preset's colors (not default theme)
            const preset = selectedPreset ?? PRESET_MAP[selectedId];
            if (preset?.colors) {
                parsed.color = {
                    light: { ...preset.colors.light },
                    dark: { ...preset.colors.dark },
                };
            } else {
                delete parsed.color;
            }
            onTokensChange(JSON.stringify(parsed, null, 2));
        } catch {
            /* keep raw text untouched when invalid JSON */
        }
    };

    // ── Color palette state ──────────────────────────────────────────────
    const [baseColor, setBaseColor] = useState('222 47% 11%');
    const [hexColor, setHexColor] = useState('#0f172a');
    // Light + dark generated palettes, editable per-token
    const [lightTokens, setLightTokens] = useState<SemanticPalette | null>(null);
    const [darkTokens, setDarkTokens] = useState<SemanticPalette | null>(null);

    // Sync color state from tokensJson when it changes (e.g. preset change resets all params)
    useEffect(() => {
        try {
            const t = JSON.parse(tokensJson || '{}') as {
                color?: { light?: { primary?: string } & Record<string, string>; dark?: Record<string, string> };
            };
            const primary = t?.color?.light?.primary;
            if (primary) {
                setBaseColor(primary);
                setHexColor(hslChannelsToHex(primary));
            }
            // Load colors into editable state (sync on preset change / external tokensJson updates)
            if (t?.color?.light) setLightTokens(t.color.light as SemanticPalette);
            if (t?.color?.dark) setDarkTokens(t.color.dark as SemanticPalette);
        } catch (error) {
            if (tokensJson) {
                const msg = error instanceof Error ? `Invalid tokens JSON: ${error.message}` : 'Invalid tokens JSON';
                toast.error(msg);
            }
        }
    }, [tokensJson]);

    const handleColorPickerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const hex = e.target.value;
        setHexColor(hex);
        const hsl = hexToHsl(hex);
        if (hsl) setBaseColor(`${hsl.h} ${hsl.s}% ${hsl.l}%`);
    }, []);

    /** Generate both light + dark palettes from the base color and auto-apply */
    const handleGenerate = useCallback(() => {
        const hsl = parseHsl(baseColor);
        if (!hsl) return;
        const light = generateSemanticDefaults(hsl.h, hsl.s, hsl.l);
        const dark = generateSemanticDefaultsDark(hsl.h, hsl.s, hsl.l);
        setLightTokens(light);
        setDarkTokens(dark);

        // Auto-apply to tokensJson for immediate persistence
        try {
            const existing = JSON.parse(tokensJson || '{}') as Record<string, unknown>;
            const color: Record<string, unknown> = { light, dark };
            onTokensChange(JSON.stringify({ ...existing, color }, null, 2));
            toast.success('Color palette generated and applied');
        } catch {
            const color: Record<string, unknown> = { light, dark };
            onTokensChange(JSON.stringify({ color }, null, 2));
            toast.success('Color palette generated and applied');
        }
    }, [baseColor, tokensJson, onTokensChange]);

    /** Update a single token in either light or dark palette */
    const handleTokenEdit = useCallback((mode: 'light' | 'dark', token: string, hex: string) => {
        const hsl = hexToHsl(hex);
        if (!hsl) return;
        const value = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
        if (mode === 'light') {
            setLightTokens((prev) => (prev ? { ...prev, [token]: value } : prev));
        } else {
            setDarkTokens((prev) => (prev ? { ...prev, [token]: value } : prev));
        }
    }, []);

    /** Write the current light + dark palettes into tokensJson (live preview updates) */
    const handleApplyToKit = useCallback(() => {
        if (!lightTokens && !darkTokens) return;
        try {
            const existing = JSON.parse(tokensJson || '{}') as Record<string, unknown>;
            const color: Record<string, unknown> = {};
            if (lightTokens) color.light = lightTokens;
            if (darkTokens) color.dark = darkTokens;
            onTokensChange(JSON.stringify({ ...existing, color }, null, 2));
        } catch {
            const color: Record<string, unknown> = {};
            if (lightTokens) color.light = lightTokens;
            if (darkTokens) color.dark = darkTokens;
            onTokensChange(JSON.stringify({ color }, null, 2));
        }
    }, [lightTokens, darkTokens, tokensJson, onTokensChange]);

    // ── Override toggle for inherited kits ────────────────────────────────
    const handleOverrideToggle = useCallback(
        (enabled: boolean) => {
            if (enabled) return;
            try {
                const parsed = JSON.parse(tokensJson || '{}') as Record<string, unknown>;
                delete parsed.color;
                onTokensChange(JSON.stringify(parsed, null, 2));
            } catch {
                onTokensChange('{}');
            }
        },
        [tokensJson, onTokensChange],
    );

    const handleSpacingRadiusShadowOverrideToggle = useCallback(
        (enabled: boolean) => {
            if (enabled) return;
            try {
                const parsed = JSON.parse(tokensJson || '{}') as Record<string, unknown>;
                delete parsed.spacing;
                delete parsed.radius;
                delete parsed.shadow;
                onTokensChange(JSON.stringify(parsed, null, 2));
            } catch {
                onTokensChange('{}');
            }
        },
        [tokensJson, onTokensChange],
    );

    const handleSplitLayoutToggle = useCallback(
        (enabled: boolean) => {
            try {
                const p = JSON.parse(tokensJson || '{}');
                if (enabled) {
                    // Duplicate into light and dark
                    if (p.spacing) p.spacing = { light: { ...p.spacing }, dark: { ...p.spacing } };
                    if (p.radius) p.radius = { light: p.radius, dark: p.radius };
                    if (p.shadow) p.shadow = { light: { ...p.shadow }, dark: { ...p.shadow } };
                } else {
                    // Revert to shared
                    if (p.spacing?.light) p.spacing = { ...p.spacing.light };
                    if (p.radius?.light) p.radius = p.radius.light;
                    if (p.shadow?.light) p.shadow = { ...p.shadow.light };
                }
                onTokensChange(JSON.stringify(p, null, 2));
            } catch {}
        },
        [tokensJson, onTokensChange],
    );

    /** Apply spacing/radius/shadow override to tokensJson */
    const handleSpacingRadiusShadowChange = useCallback(
        (
            mode: 'light' | 'dark' | 'shared',
            updates: { spacing?: Record<string, string>; radius?: string; shadow?: Record<string, string> },
        ) => {
            try {
                const existing = JSON.parse(tokensJson || '{}') as Record<string, unknown>;

                const applyUpdate = (key: 'spacing' | 'radius' | 'shadow', val: any) => {
                    if (val === undefined) return;
                    if (mode === 'shared') {
                        if (key === 'radius') existing.radius = val;
                        else existing[key] = { ...((existing[key] as object) || {}), ...val };
                    } else {
                        existing[key] = existing[key] || {};
                        const modeObj = existing[key] as any;
                        if (key === 'radius') modeObj[mode] = val;
                        else modeObj[mode] = { ...(modeObj[mode] || {}), ...val };
                    }
                };

                applyUpdate('spacing', updates.spacing);
                applyUpdate('radius', updates.radius);
                applyUpdate('shadow', updates.shadow);

                onTokensChange(JSON.stringify(existing, null, 2));
            } catch {}
        },
        [tokensJson, onTokensChange],
    );

    const handleRestoreSpacingRadiusShadow = () => {
        try {
            const parsed = JSON.parse(tokensJson || '{}') as Record<string, unknown>;
            // Restore to currently selected preset's spacing, radius, shadows
            const preset = selectedPreset ?? PRESET_MAP[selectedId];
            if (preset) {
                const p = preset as {
                    spacing?: Record<string, string>;
                    radius?: string;
                    shadows?: Record<string, string>;
                };
                if (p.spacing) parsed.spacing = { ...p.spacing };
                else delete parsed.spacing;
                if (p.radius) parsed.radius = p.radius;
                else delete parsed.radius;
                if (p.shadows) parsed.shadow = { ...p.shadows };
                else delete parsed.shadow;
            } else {
                delete parsed.spacing;
                delete parsed.radius;
                delete parsed.shadow;
            }
            onTokensChange(JSON.stringify(parsed, null, 2));
        } catch {
            /* keep raw text untouched */
        }
    };

    // ── Preset section ───────────────────────────────────────────────────
    const presetSection = (
        <Card>
            <CardHeader>
                <CardTitle>Theme preset</CardTitle>
                <CardDescription>
                    Base color palette for this Brand Kit. Use the color generator below to override individual tokens.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <OttaSelect
                    mode="single"
                    items={themePresetItems}
                    value={selectedItem ? { ...selectedItem, id: selectedItem.id, name: selectedItem.name } : null}
                    onChange={(v) => {
                        const selectedId = (v as OttaSelectItem)?.id as string | null | undefined;
                        const presetId = selectedId && selectedId !== 'default' ? selectedId : null;
                        const expandId = selectedId ?? presetId ?? 'default'; // Use for expansion (default is valid)

                        // Update preset ID
                        onThemePresetChange(presetId);

                        // Expand preset and update tokensJson for immediate preview (colors + typography + full preset)
                        if (expandId && apiPresets) {
                            const preset = apiPresets.find((p) => p.name === expandId) as
                                | {
                                      name: string;
                                      colors: { light: Record<string, string>; dark: Record<string, string> };
                                      typography?: unknown;
                                      spacing?: unknown;
                                      radius?: unknown;
                                      shadows?: unknown;
                                      motion?: unknown;
                                  }
                                | undefined;
                            if (preset) {
                                const expanded = expandPresetPreservingCursors(preset, tokensJson);
                                onTokensChange(JSON.stringify(expanded, null, 2));
                            }
                        }
                    }}
                    placeholder="Select preset"
                    searchable={false}
                    clearable={false}
                    renderItem={themePresetRenderer}
                    renderValue={(item) => (
                        <div className="flex flex-col gap-1 min-w-0">
                            <span className="truncate capitalize font-medium">{(item as OttaSelectItem).name}</span>
                            <div className="flex gap-0.5 shrink-0">
                                {((item as OttaSelectItem & { colors?: string[] }).colors ?? [])
                                    .slice(0, 5)
                                    .map((hsl: string, i: number) => (
                                        <div
                                            key={i}
                                            className={`w-4 h-4 ${colorSwatchClass}`}
                                            style={{ backgroundColor: hslToCss(hsl) }}
                                            title={hsl}
                                        />
                                    ))}
                            </div>
                        </div>
                    )}
                    className="w-full"
                />

                {/* Full resolved palette – all semantic tokens as swatches */}
                <div className="space-y-2 pt-2">
                    <p className="text-xs font-medium text-muted-foreground">Resolved palette</p>
                    <div className="flex flex-wrap gap-1.5">
                        {DISPLAY_TOKENS.map((token) => {
                            const value = resolvedColors?.[token];
                            if (!value) return null;
                            return (
                                <div
                                    key={token}
                                    className="flex flex-col items-center gap-0.5"
                                    title={`${token}: ${value}`}
                                >
                                    <div
                                        className={`h-7 w-7 ${colorSwatchClass}`}
                                        style={{ backgroundColor: hslToCss(value) }}
                                    />
                                    <span className="text-[9px] text-muted-foreground leading-tight max-w-[3.5rem] truncate">
                                        {token.replace('-foreground', '-fg')}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Primary color 50-950 shade gradient */}
                {primaryGradient && (
                    <div className="space-y-2 pt-1">
                        <p className="text-xs font-medium text-muted-foreground">Primary scale (50–950)</p>
                        <div className="flex rounded-md overflow-hidden shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] [transform:translateZ(0)]">
                            {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => (
                                <div
                                    key={step}
                                    className="flex-1 h-8 relative group [transform:translateZ(0)]"
                                    style={{ backgroundColor: primaryGradient[step] }}
                                    title={`${step}: ${primaryGradient[step]}`}
                                >
                                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono opacity-0 group-hover:opacity-100 transition-opacity mix-blend-difference text-white">
                                        {step}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    // ── Color override section ───────────────────────────────────────────
    const paletteTokenKeys = Object.keys(lightTokens ?? darkTokens ?? {}) as (keyof SemanticPalette)[];

    const colorSection = (
        <Card>
            <CardHeader>
                <CardTitle>Custom color overrides</CardTitle>
                <CardDescription>
                    Generate a cohesive light &amp; dark palette from a brand color. Click any swatch to fine-tune
                    individual tokens. Changes apply to the live preview on save.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {hasCustomColorOverrides && (
                    <div className="rounded-md border border-amber-300/50 bg-amber-50/70 p-3 text-sm dark:border-amber-700/40 dark:bg-amber-950/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Custom colors active</p>
                                <p className="text-muted-foreground mt-0.5">
                                    Token colors override the preset palette.
                                </p>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={handleRestorePresetColors}>
                                Restore preset
                            </Button>
                        </div>
                    </div>
                )}

                {/* Base color picker + generate */}
                <div className="space-y-2">
                    <Label>Brand color</Label>
                    <div className="flex h-10 flex-wrap items-center gap-3">
                        <Input
                            type="color"
                            value={hexColor}
                            onChange={handleColorPickerChange}
                            className="h-10 w-12 shrink-0 cursor-pointer p-1"
                        />
                        <Input
                            value={baseColor}
                            onChange={(e) => setBaseColor(e.target.value)}
                            placeholder="222 47% 11%"
                            className="h-10 w-44 font-mono"
                        />
                        <Button onClick={handleGenerate} variant="outline" className="h-10 shrink-0">
                            <IconRefresh className="mr-2 h-4 w-4" />
                            Generate palette
                        </Button>
                        <Button
                            onClick={handleApplyToKit}
                            disabled={!lightTokens && !darkTokens}
                            className="h-10 shrink-0"
                        >
                            <IconPalette className="mr-2 h-4 w-4" />
                            Apply to Brand Kit
                        </Button>
                    </div>
                </div>

                {/* Light + Dark palette side by side */}
                {(lightTokens || darkTokens) && (
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Light palette */}
                        {lightTokens && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-amber-400" />
                                    <p className="text-xs font-semibold">Light mode</p>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3">
                                    {paletteTokenKeys.map((token) => (
                                        <TokenSwatch
                                            key={`light-${token}`}
                                            token={token}
                                            value={lightTokens[token]}
                                            mode="light"
                                            onEdit={handleTokenEdit}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Dark palette */}
                        {darkTokens && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-indigo-500" />
                                    <p className="text-xs font-semibold">Dark mode</p>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3">
                                    {paletteTokenKeys.map((token) => (
                                        <TokenSwatch
                                            key={`dark-${token}`}
                                            token={token}
                                            value={darkTokens[token]}
                                            mode="dark"
                                            onEdit={handleTokenEdit}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );

    // ── Spacing, radius & shadows override section ───────────────────────
    const RADIUS_OPTIONS = ['0', '0.125rem', '0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem', '9999px'];

    const SHADOW_PRESETS = [
        { label: 'Flat', desc: 'No shadows', value: { xs: 'none', sm: 'none', md: 'none', lg: 'none', xl: 'none' } },
        {
            label: 'Soft',
            desc: 'Smooth, dispersed',
            value: {
                xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
            },
        },
        {
            label: 'Sharp',
            desc: 'Harsh offsets',
            value: {
                xs: '1px 1px 0px 0 rgb(0 0 0 / 0.15)',
                sm: '2px 2px 0px 0 rgb(0 0 0 / 0.15)',
                md: '4px 4px 0px 0 rgb(0 0 0 / 0.15)',
                lg: '8px 8px 0px 0 rgb(0 0 0 / 0.15)',
                xl: '12px 12px 0px 0 rgb(0 0 0 / 0.15)',
            },
        },
        {
            label: 'Deep',
            desc: 'High elevation',
            value: {
                xs: '0 4px 8px 0 rgb(0 0 0 / 0.15)',
                sm: '0 8px 16px 0 rgb(0 0 0 / 0.15)',
                md: '0 12px 24px 0 rgb(0 0 0 / 0.15)',
                lg: '0 24px 48px 0 rgb(0 0 0 / 0.15)',
                xl: '0 32px 64px 0 rgb(0 0 0 / 0.15)',
            },
        },
    ];

    const matchesPreset = (sh: any, pre: (typeof SHADOW_PRESETS)[0]) => {
        if (!sh) return false;
        return (
            (sh.xs || DEFAULT_SHADOWS.xs) === pre.value.xs &&
            (sh.sm || DEFAULT_SHADOWS.sm) === pre.value.sm &&
            (sh.md || DEFAULT_SHADOWS.md) === pre.value.md &&
            (sh.lg || DEFAULT_SHADOWS.lg) === pre.value.lg &&
            (sh.xl || DEFAULT_SHADOWS.xl) === pre.value.xl
        );
    };

    const renderSRSConfig = (mode: 'light' | 'dark' | 'shared') => {
        const getActive = (modeObj: any, defaultObj: any) => {
            if (!isSplitLayout) return extractMode(modeObj, defaultObj);
            return extractMode(modeObj?.[mode], defaultObj);
        };
        const s = getActive(parsedSpacing, DEFAULT_SPACING);
        const sh = getActive(parsedShadow, DEFAULT_SHADOWS);
        const rRaw = !isSplitLayout ? extractMode(parsedRadius, '0.5rem') : extractMode(parsedRadius?.[mode], '0.5rem');
        const r = typeof rRaw === 'string' ? rRaw : '0.5rem';

        const isDark = mode === 'dark';
        const isShared = mode === 'shared';

        return (
            <div
                className={`space-y-6 flex-1 px-4 max-w-full ${!isShared ? (isDark ? 'bg-zinc-950/20 text-white rounded-r-lg' : 'bg-white text-zinc-900 rounded-l-lg') : ''}`}
            >
                {!isShared && <h3 className="font-semibold text-sm capitalize">{mode} Mode Overrides</h3>}

                <div className="grid gap-6">
                    <div className="space-y-2">
                        <Label className={isDark ? 'text-zinc-200' : ''}>Spacing</Label>
                        <div className="space-y-2">
                            {(['section', 'card', 'element'] as const).map((key) => (
                                <div key={key} className="flex items-center gap-2">
                                    <span className="w-16 shrink-0 text-xs text-muted-foreground capitalize">
                                        {key}
                                    </span>
                                    <Input
                                        value={s[key] ?? ''}
                                        onChange={(e) =>
                                            handleSpacingRadiusShadowChange(mode, {
                                                spacing: { [key]: e.target.value.trim() || DEFAULT_SPACING[key] },
                                            })
                                        }
                                        placeholder={DEFAULT_SPACING[key]}
                                        className={`font-mono text-sm ${isDark ? 'border-zinc-800 bg-zinc-900' : ''}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className={isDark ? 'text-zinc-200' : ''}>Border radius</Label>
                        <div className="flex flex-wrap gap-2">
                            {RADIUS_OPTIONS.map((rad) => (
                                <button
                                    key={rad}
                                    type="button"
                                    onClick={() => handleSpacingRadiusShadowChange(mode, { radius: rad })}
                                    className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                                        r === rad
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : isDark
                                              ? 'border-zinc-800 hover:bg-zinc-800'
                                              : 'border-input hover:bg-accent'
                                    }`}
                                    style={{ borderRadius: rad === '9999px' ? '9999px' : rad }}
                                >
                                    {rad === '9999px' ? 'pill' : rad}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className={isDark ? 'text-zinc-200' : ''}>Shadow elevation</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {SHADOW_PRESETS.map((pre) => {
                                const active = matchesPreset(sh, pre);
                                return (
                                    <button
                                        key={pre.label}
                                        type="button"
                                        onClick={() => handleSpacingRadiusShadowChange(mode, { shadow: pre.value })}
                                        className={`flex flex-col items-start p-2 rounded-md border text-left transition-colors ${
                                            active
                                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                : `${isDark ? 'border-zinc-800 hover:border-zinc-600' : 'border-input hover:bg-accent'}`
                                        }`}
                                    >
                                        <span className={`text-sm font-semibold ${isDark ? 'text-zinc-200' : ''}`}>
                                            {pre.label}
                                        </span>
                                        <span
                                            className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-muted-foreground'}`}
                                        >
                                            {pre.desc}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <details className="mt-2 text-xs">
                            <summary
                                className={`cursor-pointer ${isDark ? 'text-zinc-400' : 'text-muted-foreground'} hover:text-primary`}
                            >
                                Advanced CSS Overrides
                            </summary>
                            <div
                                className={`space-y-2 mt-2 pl-2 border-l-2 ${isDark ? 'border-zinc-800' : 'border-muted'}`}
                            >
                                {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((level) => (
                                    <div key={level} className="flex items-center gap-2">
                                        <span className="w-6 shrink-0 text-[10px] text-muted-foreground">{level}</span>
                                        <Input
                                            value={sh[level] ?? ''}
                                            onChange={(e) =>
                                                handleSpacingRadiusShadowChange(mode, {
                                                    shadow: {
                                                        [level]: e.target.value.trim() || DEFAULT_SHADOWS[level],
                                                    },
                                                })
                                            }
                                            placeholder={DEFAULT_SHADOWS[level]}
                                            className={`font-mono text-[10px] h-6 px-1.5 ${isDark ? 'border-zinc-800 bg-zinc-900' : ''}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        );
    };

    const spacingRadiusShadowSection = (
        <Card>
            <CardHeader>
                <CardTitle>Spacing, radius &amp; shadows</CardTitle>
                <CardDescription>Override layout spacing, border radius, and shadow elevation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {hasSpacingRadiusShadowOverrides && (
                    <div className="rounded-md border border-amber-300/50 bg-amber-50/70 p-3 text-sm dark:border-amber-700/40 dark:bg-amber-950/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Custom overrides active</p>
                                <p className="text-muted-foreground mt-0.5">Overriding preset values.</p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleRestoreSpacingRadiusShadow}
                            >
                                Restore preset
                            </Button>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between rounded-lg border p-4 bg-accent/50">
                    <div>
                        <Label>Different for dark mode</Label>
                        <p className="text-xs text-muted-foreground max-w-sm">
                            Dark mode environments often need lighter colored shadows to have any visible depth.
                        </p>
                    </div>
                    <Switch checked={isSplitLayout} onCheckedChange={handleSplitLayoutToggle} />
                </div>

                {!isSplitLayout ? (
                    <div className="-mx-4 pb-4">{renderSRSConfig('shared')}</div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-0 divide-y xl:divide-y-0 xl:divide-x border border-border rounded-lg dark:divide-zinc-800 dark:border-zinc-800">
                        <div className="py-4 bg-white/50">{renderSRSConfig('light')}</div>
                        <div className="py-4 bg-black/5">{renderSRSConfig('dark')}</div>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    // ── Token usage reference ────────────────────────────────────────────
    const tokenUsageSection = (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm">Token reference</CardTitle>
                <CardDescription>Where each color token appears in the UI.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                    {DISPLAY_TOKENS.map((token) => {
                        const usage = TOKEN_USAGE[token];
                        if (!usage) return null;
                        const color = resolvedColors?.[token];
                        return (
                            <div key={token} className="flex items-center gap-2 py-1">
                                <div
                                    className={`h-3.5 w-3.5 shrink-0 rounded-sm ${colorSwatchClass}`}
                                    style={{ backgroundColor: color ? hslToCss(color) : 'transparent' }}
                                />
                                <span className="text-[11px] font-medium min-w-[5.5rem] shrink-0">
                                    {token.replace('-foreground', '-fg')}
                                </span>
                                <span className="text-[11px] text-muted-foreground truncate">{usage}</span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );

    // ── Render ───────────────────────────────────────────────────────────
    if (hasParent) {
        return (
            <div className="space-y-6">
                {presetSection}
                <OverrideSection label="Colors" isOverridden={hasCustomColorOverrides} onToggle={handleOverrideToggle}>
                    {colorSection}
                </OverrideSection>
                <OverrideSection
                    label="Spacing, radius & shadows"
                    isOverridden={hasSpacingRadiusShadowOverrides}
                    onToggle={handleSpacingRadiusShadowOverrideToggle}
                >
                    {spacingRadiusShadowSection}
                </OverrideSection>
                {tokenUsageSection}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {presetSection}
            {colorSection}
            {spacingRadiusShadowSection}
            {tokenUsageSection}
        </div>
    );
}
