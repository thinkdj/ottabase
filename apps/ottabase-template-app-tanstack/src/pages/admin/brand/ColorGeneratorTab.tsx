import {
    buildTokensFromBaseColor,
    calculateContrastRatio,
    generatePalette,
    generateSemanticDefaults,
    hexToHsl,
    type SemanticPalette,
} from '@ottabase/brand-engine';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Separator,
} from '@ottabase/ui-shadcn';
import { IconPalette, IconRefresh } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useBrand } from '@ottabase/brand-engine-react';
import { themeVariantApi } from './brandApi';

function parseHsl(hslStr: string) {
    const parts = hslStr
        .replace(/deg|%|,/g, '')
        .split(' ')
        .filter(Boolean)
        .map(Number);
    if (parts.length < 3) return null;
    return { h: parts[0], s: parts[1], l: parts[2] };
}

export function ColorGeneratorTab() {
    const queryClient = useQueryClient();
    const { refresh } = useBrand();
    const [baseColor, setBaseColor] = useState('222 47% 11%');
    const [hexColor, setHexColor] = useState('#0f172a');
    const [palette, setPalette] = useState<Record<number, string> | null>(null);
    const [semanticTokens, setSemanticTokens] = useState<SemanticPalette | null>(null);
    const [fgColor, setFgColor] = useState('#ffffff');
    const [bgColor, setBgColor] = useState('#0f172a');
    const [contrast, setContrast] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        handleGeneratePalette();
    }, []);

    const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const hex = e.target.value;
        setHexColor(hex);
        const hsl = hexToHsl(hex);
        if (hsl) {
            setBaseColor(`${hsl.h} ${hsl.s}% ${hsl.l}%`);
            setPalette(generatePalette(hsl.h, hsl.s, hsl.l));
            setSemanticTokens(generateSemanticDefaults(hsl.h, hsl.s, hsl.l));
        }
    };

    const handleGeneratePalette = () => {
        const hsl = parseHsl(baseColor);
        if (hsl) {
            setPalette(generatePalette(hsl.h, hsl.s, hsl.l));
            setSemanticTokens(generateSemanticDefaults(hsl.h, hsl.s, hsl.l));
        }
    };

    const handleCheckContrast = () => {
        setContrast(calculateContrastRatio(fgColor, bgColor));
    };

    const handleSaveAsThemeVariant = async () => {
        const hsl = parseHsl(baseColor);
        if (!hsl) {
            toast.error('Invalid base color');
            return;
        }
        setSaving(true);
        try {
            const tokens = buildTokensFromBaseColor(hsl.h, hsl.s, hsl.l);
            await themeVariantApi.create({
                name: `Generated ${hexColor}`,
                description: `From base color ${baseColor}`,
                tokensJson: JSON.stringify(tokens),
            });
            queryClient.invalidateQueries({ queryKey: ['brand', 'themes'] });
            toast.success('Theme variant created');
            refresh();
        } catch {
            toast.error('Failed to create theme variant');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <IconPalette className="h-5 w-5" />
                            Color Generator
                        </CardTitle>
                        <CardDescription>
                            Generate a full color system from a single base color. Save as theme variant to use in
                            presets.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="space-y-2">
                                <Label>Base Color</Label>
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
                                        className="w-40 font-mono"
                                    />
                                    <Button onClick={handleGeneratePalette} size="sm">
                                        <IconRefresh className="mr-2 h-4 w-4" />
                                        Generate
                                    </Button>
                                </div>
                            </div>
                            <Button
                                onClick={handleSaveAsThemeVariant}
                                disabled={saving || !semanticTokens}
                                size="sm"
                                variant="default"
                            >
                                {saving ? 'Saving...' : 'Save as Theme Variant'}
                            </Button>
                        </div>

                        {semanticTokens && (
                            <>
                                <Separator />
                                <div className="space-y-4">
                                    <h3 className="font-semibold">Semantic Tokens (Light)</h3>
                                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                                        {Object.entries(semanticTokens).map(([token, value]) => (
                                            <div
                                                key={token}
                                                className="flex items-center gap-2 rounded-lg border p-2 bg-card/50"
                                            >
                                                <div
                                                    className="h-8 w-8 shrink-0 rounded border shadow-sm"
                                                    style={{ backgroundColor: `hsl(${value})` }}
                                                />
                                                <div className="min-w-0">
                                                    <p className="truncate text-xs font-medium">{token}</p>
                                                    <p className="truncate text-[10px] font-mono text-muted-foreground">
                                                        {value}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {palette && (
                            <>
                                <Separator />
                                <div className="space-y-4">
                                    <h3 className="font-semibold">Palette (50–950)</h3>
                                    <div className="grid grid-cols-11 gap-1">
                                        {Object.entries(palette).map(([step, hex]) => (
                                            <div
                                                key={step}
                                                className="group cursor-pointer space-y-1 text-center"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(hex);
                                                    toast.success('Copied');
                                                }}
                                                title={hex}
                                            >
                                                <div
                                                    className="h-10 w-full rounded border shadow-sm transition-all hover:ring-2 hover:ring-ring hover:ring-offset-1"
                                                    style={{ backgroundColor: hex }}
                                                />
                                                <div className="text-[10px] font-mono text-muted-foreground">
                                                    {step}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Contrast Checker</CardTitle>
                        <CardDescription>Check WCAG contrast compliance.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Foreground (Hex)</Label>
                                <Input value={fgColor} onChange={(e) => setFgColor(e.target.value)} />
                                <div className="h-4 w-full rounded border" style={{ backgroundColor: fgColor }} />
                            </div>
                            <div className="space-y-2">
                                <Label>Background (Hex)</Label>
                                <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
                                <div className="h-4 w-full rounded border" style={{ backgroundColor: bgColor }} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between border-t pt-4">
                            <div className="text-sm font-medium">Contrast Ratio</div>
                            <div
                                className={`text-2xl font-bold ${
                                    (contrast ?? 0) >= 4.5
                                        ? 'text-green-600 dark:text-green-400'
                                        : (contrast ?? 0) >= 3
                                          ? 'text-yellow-600 dark:text-yellow-400'
                                          : 'text-red-600 dark:text-red-400'
                                }`}
                            >
                                {contrast ? `${contrast.toFixed(2)} : 1` : '-'}
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            AA (Normal): {(contrast ?? 0) >= 4.5 ? '✅' : '❌'} — AA (Large):{' '}
                            {(contrast ?? 0) >= 3 ? '✅' : '❌'}
                        </p>
                        <Button className="w-full" onClick={handleCheckContrast}>
                            Check Contrast
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
