import { getThemeOrDefault, injectFont } from '@ottabase/brand-engine';
import { GOOGLE_FONTS, fontToTypography } from '@ottabase/brand-engine/fonts';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@ottabase/ui-shadcn';
import { useCallback, useEffect, useMemo } from 'react';
import { OverrideSection } from './OverrideSection';

interface BrandKitFontsTabProps {
    tokensJson: string;
    themePresetId: string | null;
    onTokensChange: (tokensJson: string) => void;
    /** When true, wrap section in an override toggle (inherited kit) */
    hasParent?: boolean;
}

function applyFontOverride(tokensJson: string, role: 'heading' | 'body' | 'handwriting', fontFamily: string): string {
    try {
        const t = JSON.parse(tokensJson || '{}') as Record<string, unknown>;
        t.typography = t.typography || {};
        const typo = t.typography as Record<string, { fontFamily: string; url?: string }>;
        typo[role] = fontToTypography(fontFamily, role);
        return JSON.stringify(t, null, 2);
    } catch {
        return JSON.stringify({ typography: { [role]: fontToTypography(fontFamily, role) } }, null, 2);
    }
}

export function BrandKitFontsTab({ tokensJson, themePresetId, onTokensChange, hasParent }: BrandKitFontsTabProps) {
    const presetTypo = getThemeOrDefault(themePresetId || 'default').tokens?.typography;
    const parsed = useMemo(() => {
        try {
            return JSON.parse(tokensJson || '{}') as {
                typography?: {
                    heading?: { fontFamily?: string };
                    body?: { fontFamily?: string };
                    handwriting?: { fontFamily?: string };
                };
            };
        } catch {
            return {} as {
                typography?: {
                    heading?: { fontFamily?: string };
                    body?: { fontFamily?: string };
                    handwriting?: { fontFamily?: string };
                };
            };
        }
    }, [tokensJson]);
    const fontHeading = parsed?.typography?.heading?.fontFamily ?? presetTypo?.heading?.fontFamily ?? 'Inter';
    const fontBody = parsed?.typography?.body?.fontFamily ?? presetTypo?.body?.fontFamily ?? 'Inter';
    const fontHandwriting =
        parsed?.typography?.handwriting?.fontFamily ?? presetTypo?.handwriting?.fontFamily ?? 'Caveat';

    const handleFontChange = (role: 'heading' | 'body' | 'handwriting', fontFamily: string) => {
        onTokensChange(applyFontOverride(tokensJson, role, fontFamily));
    };

    // Load selected fonts for preview
    useEffect(() => {
        const urls: string[] = [];
        const h = fontToTypography(fontHeading, 'heading');
        const b = fontToTypography(fontBody, 'body');
        const w = fontToTypography(fontHandwriting, 'handwriting');
        if (h.url) urls.push(h.url);
        if (b.url) urls.push(b.url);
        if (w.url) urls.push(w.url);
        urls.forEach((url) => injectFont(url));
    }, [fontHeading, fontBody, fontHandwriting]);

    // Determine if typography section is overridden (has local typography tokens)
    const hasTypographyOverride = useMemo(() => {
        try {
            const p = JSON.parse(tokensJson || '{}') as { typography?: unknown };
            return Boolean(p.typography);
        } catch {
            return false;
        }
    }, [tokensJson]);

    // Toggle typography override: OFF = remove typography from tokensJson
    const handleOverrideToggle = useCallback(
        (enabled: boolean) => {
            if (enabled) return;
            try {
                const p = JSON.parse(tokensJson || '{}') as Record<string, unknown>;
                delete p.typography;
                onTokensChange(JSON.stringify(p, null, 2));
            } catch {
                onTokensChange('{}');
            }
        },
        [tokensJson, onTokensChange],
    );

    const FONT_PREVIEW = {
        heading: 'The quick brown fox jumps over the lazy dog',
        body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.',
        handwriting: 'Welcome! Your message here.',
    };

    const fontEditor = (
        <Card>
            <CardHeader>
                <CardTitle>Typography</CardTitle>
                <CardDescription>
                    Select Google Fonts for heading, body, and handwriting. Changes reflect in preview.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label>Heading</Label>
                    <Select value={fontHeading} onValueChange={(v) => handleFontChange('heading', v)}>
                        <SelectTrigger className="mt-1.5">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[
                                ...GOOGLE_FONTS.filter((f) => ['sans-serif', 'serif', 'display'].includes(f.category)),
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
                    <p
                        className="mt-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-lg font-semibold dark:border-muted"
                        style={{ fontFamily: `"${fontHeading}", system-ui, sans-serif` }}
                    >
                        {FONT_PREVIEW.heading}
                    </p>
                </div>
                <div>
                    <Label>Body</Label>
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
                    <p
                        className="mt-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm leading-relaxed dark:border-muted"
                        style={{ fontFamily: `"${fontBody}", sans-serif` }}
                    >
                        {FONT_PREVIEW.body}
                    </p>
                </div>
                <div>
                    <Label>Handwriting</Label>
                    <Select value={fontHandwriting} onValueChange={(v) => handleFontChange('handwriting', v)}>
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
                    <p
                        className="mt-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-lg dark:border-muted"
                        style={{ fontFamily: `"${fontHandwriting}", cursive` }}
                    >
                        {FONT_PREVIEW.handwriting}
                    </p>
                </div>
            </CardContent>
        </Card>
    );

    // Standalone kit: show editor directly. Inherited kit: wrap in override toggle.
    if (!hasParent) {
        return <div className="space-y-6">{fontEditor}</div>;
    }

    return (
        <div className="space-y-6">
            <OverrideSection label="Typography" isOverridden={hasTypographyOverride} onToggle={handleOverrideToggle}>
                {fontEditor}
            </OverrideSection>
        </div>
    );
}
