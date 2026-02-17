// ---------------------------------------------------------------------------
// Theme tab – Preset picker + color palette override (merged view)
// ---------------------------------------------------------------------------

import {
    buildPreviewTheme,
    generatePalette,
    generateSemanticDefaults,
    generateSemanticDefaultsDark,
    getThemePresetItems,
    hexToHsl,
    THEME_PRESET_ITEMS,
    type SemanticPalette,
} from '@ottabase/brand-engine';
import { OttaSelect, type ItemRendererProps, type OttaSelectItem } from '@ottabase/ottaselect';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@ottabase/ui-shadcn';
import { IconPalette, IconRefresh } from '@tabler/icons-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
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

/** Custom renderer for theme preset items in OttaSelect dropdown (render function, not a component) */
const themePresetRenderer = ({ item }: ItemRendererProps) => (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <span className="truncate font-medium capitalize">{item.name}</span>
        <div className="flex gap-1 shrink-0">
            {((item.colors as string[]) ?? []).slice(0, 5).map((hsl, i) => (
                <div
                    key={i}
                    className="w-5 h-5 rounded border border-border dark:border-muted shrink-0"
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
                <div
                    className="h-7 w-7 rounded border shadow-sm dark:border-muted"
                    style={{ backgroundColor: hslToCss(value) }}
                />
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
    const themePresetItems = useMemo(() => {
        const runtimeItems = getThemePresetItems();
        if (runtimeItems.length <= 1) return THEME_PRESET_ITEMS;
        const palettes = runtimeItems.map((item) => item.colors.join('|'));
        return new Set(palettes).size > 1 ? runtimeItems : THEME_PRESET_ITEMS;
    }, []);

    const selectedId = themePresetId ?? 'default';
    const selectedItem = themePresetItems.find((t) => t.id === selectedId) ?? themePresetItems[0];

    // Resolve the full color palette for the selected preset (light mode)
    const resolvedColors = useMemo(() => {
        const theme = buildPreviewTheme({ tokensJson, themePresetId }, 'light');
        return theme.colors;
    }, [tokensJson, themePresetId]);

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
            return !!(JSON.parse(tokensJson || '{}') as { color?: unknown })?.color;
        } catch {
            return false;
        }
    }, [tokensJson]);

    const handleRestorePresetColors = () => {
        try {
            const parsed = JSON.parse(tokensJson || '{}') as Record<string, unknown>;
            if (!parsed.color) return;
            delete parsed.color;
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

    // Sync base color from existing tokensJson on load
    useEffect(() => {
        try {
            const t = JSON.parse(tokensJson || '{}') as {
                color?: { light?: { primary?: string }; dark?: { primary?: string } };
            };
            const primary = t?.color?.light?.primary;
            if (primary) {
                setBaseColor(primary);
                setHexColor(hslChannelsToHex(primary));
            }
            // Load existing overrides into editable state
            if (t?.color?.light) setLightTokens(t.color.light as SemanticPalette);
            if (t?.color?.dark) setDarkTokens(t.color.dark as SemanticPalette);
        } catch (error) {
            if (tokensJson) {
                const msg = error instanceof Error ? `Invalid tokens JSON: ${error.message}` : 'Invalid tokens JSON';
                toast.error(msg);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only on mount — local edits drive state after this

    const handleColorPickerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const hex = e.target.value;
        setHexColor(hex);
        const hsl = hexToHsl(hex);
        if (hsl) setBaseColor(`${hsl.h} ${hsl.s}% ${hsl.l}%`);
    }, []);

    /** Generate both light + dark palettes from the base color */
    const handleGenerate = useCallback(() => {
        const hsl = parseHsl(baseColor);
        if (!hsl) return;
        const light = generateSemanticDefaults(hsl.h, hsl.s, hsl.l);
        const dark = generateSemanticDefaultsDark(hsl.h, hsl.s, hsl.l);
        setLightTokens(light);
        setDarkTokens(dark);
    }, [baseColor]);

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
                    value={selectedItem ? { id: selectedItem.id, name: selectedItem.name, ...selectedItem } : null}
                    onChange={(v) =>
                        onThemePresetChange(
                            v && (v as OttaSelectItem).id !== 'default' ? (v as OttaSelectItem).id : null,
                        )
                    }
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
                                            className="w-4 h-4 rounded border border-border dark:border-muted shrink-0"
                                            style={{ backgroundColor: hslToCss(hsl) }}
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
                                        className="h-7 w-7 rounded border border-border shadow-sm dark:border-muted"
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
                        <div className="flex rounded-md overflow-hidden border border-border dark:border-muted">
                            {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => (
                                <div
                                    key={step}
                                    className="flex-1 h-8 relative group"
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
                <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-2">
                        <Label>Brand color</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="color"
                                value={hexColor}
                                onChange={handleColorPickerChange}
                                className="h-10 w-12 cursor-pointer p-1"
                            />
                            <Input
                                value={baseColor}
                                onChange={(e) => setBaseColor(e.target.value)}
                                placeholder="222 47% 11%"
                                className="w-44 font-mono"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleGenerate} size="sm" variant="outline">
                            <IconRefresh className="mr-2 h-4 w-4" />
                            Generate palette
                        </Button>
                        <Button onClick={handleApplyToKit} disabled={!lightTokens && !darkTokens}>
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
                                    className="h-3.5 w-3.5 shrink-0 rounded-sm border dark:border-muted"
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
                {tokenUsageSection}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {presetSection}
            {colorSection}
            {tokenUsageSection}
        </div>
    );
}
