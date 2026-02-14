import { useMemo } from 'react';
import { THEME_PRESET_ITEMS, getThemePresetItems } from '@ottabase/brand-engine';
import { OttaSelect, type ItemRendererProps, type OttaSelectItem } from '@ottabase/ottaselect';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from '@ottabase/ui-shadcn';

/** Convert HSL string "221 83% 53%" or "217 91% 60% / 0.1" to CSS hsl() */
function hslToCss(hsl: string): string {
    const base = hsl.split('/')[0].trim();
    const parts = base
        .split(/\s+/)
        .map((value) => parseFloat(value))
        .filter((n) => !Number.isNaN(n));
    if (parts.length < 3) return 'hsl(221, 83%, 53%)';
    return `hsl(${parts[0]}, ${parts[1]}%, ${parts[2]}%)`;
}

interface BrandKitThemeTabProps {
    themePresetId: string | null;
    tokensJson: string;
    onThemePresetChange: (id: string | null) => void;
    onTokensChange: (tokensJson: string) => void;
}

export function BrandKitThemeTab({
    themePresetId,
    tokensJson,
    onThemePresetChange,
    onTokensChange,
}: BrandKitThemeTabProps) {
    const themePresetItems = useMemo(() => {
        const runtimeItems = getThemePresetItems();
        if (runtimeItems.length <= 1) return THEME_PRESET_ITEMS;
        const palettes = runtimeItems.map((item) => item.colors.join('|'));
        const hasDistinctPalettes = new Set(palettes).size > 1;
        return hasDistinctPalettes ? runtimeItems : THEME_PRESET_ITEMS;
    }, []);
    const selectedId = themePresetId ?? 'default';
    const selectedItem = themePresetItems.find((t) => t.id === selectedId) ?? themePresetItems[0];
    const hasCustomColorOverrides = useMemo(() => {
        try {
            const parsed = JSON.parse(tokensJson || '{}') as { color?: unknown };
            return !!parsed?.color;
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
            // Keep the raw text untouched when invalid JSON
        }
    };

    const ThemePresetRenderer = ({ item }: ItemRendererProps) => (
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

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Base theme preset</CardTitle>
                    <CardDescription>
                        Choose the base palette for this Brand Kit. If custom color tokens exist, they override the
                        preset until restored.
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
                        renderItem={ThemePresetRenderer}
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
                    {hasCustomColorOverrides ? (
                        <div className="rounded-md border border-amber-300/50 bg-amber-50/70 p-3 text-sm dark:border-amber-700/40 dark:bg-amber-950/20">
                            <p className="font-medium">Custom color overrides are active</p>
                            <p className="text-muted-foreground mt-1">
                                The preview and app will use token color values instead of the selected preset.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={handleRestorePresetColors}
                            >
                                Restore preset colors
                            </Button>
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Design tokens JSON</CardTitle>
                    <CardDescription>
                        Override typography, spacing, radius, shadow, and motion. Add color tokens only when you
                        intentionally want to override the preset.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Label htmlFor="tokensJson" className="sr-only">
                        Tokens JSON
                    </Label>
                    <textarea
                        id="tokensJson"
                        className="w-full min-h-[200px] rounded-md border bg-background px-3 py-2 font-mono text-sm dark:border-muted"
                        value={tokensJson}
                        onChange={(e) => onTokensChange(e.target.value)}
                        placeholder='{"color":{"light":{"primary":"222.2 47.4% 11.2%"}}}'
                        spellCheck={false}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
