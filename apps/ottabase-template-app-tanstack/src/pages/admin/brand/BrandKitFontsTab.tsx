import { getThemeOrDefault } from '@ottabase/brand-engine';
import { GOOGLE_FONTS, fontToTypography } from '@ottabase/brand-engine/fonts';
import {
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@ottabase/ui-shadcn';

interface BrandKitFontsTabProps {
    tokensJson: string;
    themePresetId: string | null;
    onTokensChange: (tokensJson: string) => void;
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

export function BrandKitFontsTab({ tokensJson, themePresetId, onTokensChange }: BrandKitFontsTabProps) {
    const presetTypo = getThemeOrDefault(themePresetId || 'default').tokens?.typography;
    let parsed: {
        typography?: {
            heading?: { fontFamily?: string };
            body?: { fontFamily?: string };
            handwriting?: { fontFamily?: string };
        };
    } = {};
    try {
        parsed = JSON.parse(tokensJson || '{}') as typeof parsed;
    } catch {
        /* ignore */
    }
    const fontHeading = parsed?.typography?.heading?.fontFamily ?? presetTypo?.heading?.fontFamily ?? 'Inter';
    const fontBody = parsed?.typography?.body?.fontFamily ?? presetTypo?.body?.fontFamily ?? 'Inter';
    const fontHandwriting =
        parsed?.typography?.handwriting?.fontFamily ?? presetTypo?.handwriting?.fontFamily ?? 'Caveat';

    const handleFontChange = (role: 'heading' | 'body' | 'handwriting', fontFamily: string) => {
        onTokensChange(applyFontOverride(tokensJson, role, fontFamily));
    };

    return (
        <div className="space-y-6">
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
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
