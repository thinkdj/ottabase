import {
    buildTokensFromBaseColor,
    hexToHsl,
    generateSemanticDefaults,
    type SemanticPalette,
} from '@ottabase/brand-engine';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@ottabase/ui-shadcn';
import { IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

function parseHsl(hslStr: string) {
    const parts = hslStr
        .replace(/deg|%|,/g, '')
        .split(' ')
        .filter(Boolean)
        .map(Number);
    if (parts.length < 3) return null;
    return { h: parts[0], s: parts[1], l: parts[2] };
}

interface BrandKitColorsTabProps {
    tokensJson: string;
    onTokensChange: (tokensJson: string) => void;
}

export function BrandKitColorsTab({ tokensJson, onTokensChange }: BrandKitColorsTabProps) {
    const [baseColor, setBaseColor] = useState('222 47% 11%');
    const [hexColor, setHexColor] = useState('#0f172a');
    const [semanticTokens, setSemanticTokens] = useState<SemanticPalette | null>(null);

    // Parse existing tokens for initial state
    useEffect(() => {
        try {
            const t = JSON.parse(tokensJson || '{}') as { color?: { light?: { primary?: string } } };
            const primary = t?.color?.light?.primary;
            if (primary) {
                setBaseColor(primary);
                // No direct hex from HSL, skip hexColor
            }
        } catch (error) {
            if (tokensJson) {
                const message =
                    error instanceof Error ? `Invalid tokens JSON: ${error.message}` : 'Invalid tokens JSON';
                toast.error(message);
            }
        }
    }, [tokensJson]);

    // Memoize expensive palette generation based on base color
    const generatedTokens = useMemo(() => {
        const hsl = parseHsl(baseColor);
        if (!hsl) return null;
        return generateSemanticDefaults(hsl.h, hsl.s, hsl.l);
    }, [baseColor]);

    const handleColorPickerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const hex = e.target.value;
        setHexColor(hex);
        const hsl = hexToHsl(hex);
        if (hsl) {
            setBaseColor(`${hsl.h} ${hsl.s}% ${hsl.l}%`);
        }
    }, []);

    const handleGenerate = useCallback(() => {
        // Use pre-computed generatedTokens from useMemo
        if (generatedTokens) {
            setSemanticTokens(generatedTokens);
        }
    }, [generatedTokens]);

    const handleApplyToKit = useCallback(() => {
        const hsl = parseHsl(baseColor);
        if (!hsl) return;
        const tokens = buildTokensFromBaseColor(hsl.h, hsl.s, hsl.l);
        // Merge with existing tokensJson (keep typography, etc.)
        try {
            const existing = JSON.parse(tokensJson || '{}') as Record<string, unknown>;
            onTokensChange(
                JSON.stringify(
                    {
                        ...existing,
                        color: tokens.color,
                    },
                    null,
                    2,
                ),
            );
        } catch (error) {
            if (tokensJson) {
                const message =
                    error instanceof Error
                        ? `Existing tokens JSON is invalid (${error.message}). Replacing color tokens only.`
                        : 'Existing tokens JSON is invalid. Replacing color tokens only.';
                toast.error(message);
            }
            onTokensChange(JSON.stringify({ color: tokens.color }, null, 2));
        }
    }, [baseColor, tokensJson, onTokensChange]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Color palette</CardTitle>
                    <CardDescription>
                        Pick a base color to generate a full semantic palette. Apply to update this Brand Kit.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="space-y-2">
                            <Label>Base color</Label>
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
                                <Button onClick={handleGenerate} size="sm">
                                    <IconRefresh className="mr-2 h-4 w-4" />
                                    Generate
                                </Button>
                            </div>
                        </div>
                        <Button onClick={handleApplyToKit} disabled={!semanticTokens}>
                            Apply to Brand Kit
                        </Button>
                    </div>

                    {semanticTokens && (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                            {Object.entries(semanticTokens).map(([token, value]) => (
                                <div
                                    key={token}
                                    className="flex items-center gap-2 rounded-lg border p-2 bg-card/50 dark:border-muted"
                                >
                                    <div
                                        className="h-8 w-8 shrink-0 rounded border shadow-sm dark:border-muted"
                                        style={{ backgroundColor: `hsl(${value})` }}
                                    />
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-medium">{token}</p>
                                        <p className="truncate text-[10px] font-mono text-muted-foreground">{value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
