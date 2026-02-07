import {
    calculateContrastRatio,
    generatePalette,
    generateSemanticDefaults,
    hexToHsl,
    SemanticPalette,
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
import { Palette, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

// Helper to convert HSL string (e.g. "222 47% 11%") to H/S/L numbers
function parseHsl(hslStr: string) {
    const parts = hslStr
        .replace(/deg|%|,/g, '')
        .split(' ')
        .filter(Boolean)
        .map(Number);
    if (parts.length < 3) return null;
    return { h: parts[0], s: parts[1], l: parts[2] };
}

export function ThemeGeneratorPage() {
    // State for Palette Generator
    const [baseColor, setBaseColor] = useState('222 47% 11%'); // Default dark blue
    const [hexColor, setHexColor] = useState('#0f172a'); // Syncs with baseColor
    const [palette, setPalette] = useState<Record<number, string> | null>(null);
    const [semanticTokens, setSemanticTokens] = useState<SemanticPalette | null>(null);

    // State for Contrast Checker
    const [fgColor, setFgColor] = useState('#ffffff');
    const [bgColor, setBgColor] = useState('#0f172a');
    const [contrast, setContrast] = useState<number | null>(null);

    // Initial load
    useEffect(() => {
        handleGeneratePalette();
    }, []);

    const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const hex = e.target.value;
        setHexColor(hex);
        const hsl = hexToHsl(hex);
        if (hsl) {
            setBaseColor(`${hsl.h} ${hsl.s}% ${hsl.l}%`);
            // Auto-generate on picker change
            setPalette(generatePalette(hsl.h, hsl.s, hsl.l));
            setSemanticTokens(generateSemanticDefaults(hsl.h, hsl.s, hsl.l));
        }
    };

    const handleGeneratePalette = () => {
        const hsl = parseHsl(baseColor);
        if (hsl) {
            setPalette(generatePalette(hsl.h, hsl.s, hsl.l));
            setSemanticTokens(generateSemanticDefaults(hsl.h, hsl.s, hsl.l));
        } else {
            // alert('Invalid HSL format. Use: 222 47% 11%');
        }
    };

    const handleCheckContrast = () => {
        const ratio = calculateContrastRatio(fgColor, bgColor);
        setContrast(ratio);
    };

    return (
        <div className="p-6 space-y-8 max-w-5xl mx-auto">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Theme Utilities</h1>
                <p className="text-muted-foreground">
                    Tools to generate theme palettes and verify accessibility compliance.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Palette Generator */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Theme Generator</CardTitle>
                        <CardDescription>Generate a full color system from a single base color.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {/* Input Section */}
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="space-y-2">
                                <Label>Base Color</Label>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex items-center">
                                        <Input
                                            type="color"
                                            value={hexColor}
                                            onChange={handleColorPickerChange}
                                            className="w-12 h-10 p-1 cursor-pointer"
                                        />
                                    </div>
                                    <Input
                                        value={baseColor}
                                        onChange={(e) => setBaseColor(e.target.value)}
                                        placeholder="222 47% 11%"
                                        className="w-40 font-mono"
                                    />
                                    <Button onClick={handleGeneratePalette}>
                                        <RefreshCw className="mr-2 h-4 w-4" /> Generate
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground">Pick a color or enter HSL</p>
                            </div>
                        </div>

                        <Separator />

                        {/* Scale Palette */}
                        {palette && (
                            <div className="space-y-4">
                                <h3 className="font-semibold">generated-palette (50-950)</h3>
                                <div className="grid grid-cols-11 gap-1">
                                    {Object.entries(palette).map(([step, hex]) => (
                                        <div key={step} className="space-y-1 text-center group">
                                            <div
                                                className="h-12 w-full rounded shadow-sm border cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-ring transition-all"
                                                style={{ backgroundColor: hex }}
                                                onClick={() => navigator.clipboard.writeText(hex)}
                                                title="Click to copy Hex"
                                            />
                                            <div className="text-[10px] text-muted-foreground font-mono">{step}</div>
                                            <div className="hidden group-hover:block text-[10px] font-mono absolute bg-popover p-1 rounded border shadow-md z-10 w-max -ml-2">
                                                {hex}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Separator />

                        {/* Semantic Tokens Grid */}
                        {semanticTokens && (
                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Palette className="h-4 w-4" /> Semantic Tokens (Light Mode Defaults)
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {Object.entries(semanticTokens).map(([token, value]) => (
                                        <div key={token} className="space-y-1.5 p-3 border rounded-lg bg-card/50">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="h-8 w-8 rounded border shadow-sm shrink-0"
                                                    style={{ backgroundColor: `hsl(${value})` }}
                                                />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium truncate" title={token}>
                                                        {token}
                                                    </p>
                                                    <p
                                                        className="text-[10px] text-muted-foreground font-mono truncate"
                                                        title={value}
                                                    >
                                                        {value}
                                                    </p>
                                                </div>
                                            </div>
                                            <Input
                                                value={value}
                                                onChange={(e) =>
                                                    setSemanticTokens((prev: SemanticPalette | null) =>
                                                        prev ? { ...prev, [token]: e.target.value } : null,
                                                    )
                                                }
                                                className="h-6 text-[10px] font-mono"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Contrast Checker (Existing) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Contrast Checker</CardTitle>
                        <CardDescription>Check WCAG contrast compliance between two colors.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Foreground (Hex)</Label>
                                <Input
                                    value={fgColor}
                                    onChange={(e) => {
                                        setFgColor(e.target.value);
                                        handleCheckContrast();
                                    }}
                                />
                                <div className="h-4 w-full rounded border" style={{ backgroundColor: fgColor }}></div>
                            </div>
                            <div className="space-y-2">
                                <Label>Background (Hex)</Label>
                                <Input
                                    value={bgColor}
                                    onChange={(e) => {
                                        setBgColor(e.target.value);
                                        handleCheckContrast();
                                    }}
                                />
                                <div className="h-4 w-full rounded border" style={{ backgroundColor: bgColor }}></div>
                            </div>
                        </div>

                        <div className="pt-4 flex items-center justify-between border-t mt-4">
                            <div className="text-sm font-medium">Contrast Ratio</div>
                            <div
                                className={`text-2xl font-bold ${
                                    (contrast || 0) >= 4.5
                                        ? 'text-green-600'
                                        : (contrast || 0) >= 3
                                          ? 'text-yellow-600'
                                          : 'text-red-600'
                                }`}
                            >
                                {contrast ? contrast.toFixed(2) : '-'} : 1
                            </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Passes WCAG AA: {(contrast || 0) >= 4.5 ? '✅ Yes' : '❌ No'} (Normal Text)
                            <br />
                            Passes WCAG AA: {(contrast || 0) >= 3 ? '✅ Yes' : '❌ No'} (Large Text)
                        </div>
                        <Button className="w-full mt-2" onClick={handleCheckContrast}>
                            Recalculate
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
