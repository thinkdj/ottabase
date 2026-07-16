import type { TokenTypography } from '@ottabase/brand-engine';
import { getThemeOrDefault, injectFont } from '@ottabase/brand-engine';
import { GOOGLE_FONTS, fontToTypography } from '@ottabase/brand-engine/fonts';
import { OttaSelect, type OttaSelectItem } from '@ottabase/ottaselect';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Label,
    NativeSelect,
    NativeSelectOption,
    Switch,
} from '@ottabase/ui-shadcn';
import { useCallback, useEffect, useMemo } from 'react';
import { OverrideSection } from './OverrideSection';

interface FontRoleEditorProps {
    mode: 'light' | 'dark' | 'shared';
    role: 'heading' | 'body' | 'handwriting';
    config: any;
    presetTypo: any;
    onUpdate: (
        mode: 'light' | 'dark' | 'shared',
        role: 'heading' | 'body' | 'handwriting',
        updates: Partial<TokenTypography>,
    ) => void;
    onFontFamilyChange: (
        mode: 'light' | 'dark' | 'shared',
        role: 'heading' | 'body' | 'handwriting',
        family: string,
    ) => void;
}

/** Proper React component so useMemo is called at a stable component boundary, not inside a loop. */
function FontRoleEditor({ mode, role, config, presetTypo, onUpdate, onFontFamilyChange }: FontRoleEditorProps) {
    const fallbacks = presetTypo?.[role] || {};
    const fontFam = config[role]?.fontFamily || fallbacks.fontFamily || (role === 'handwriting' ? 'Caveat' : 'Inter');
    const lineHeight = config[role]?.lineHeight || 'normal';
    const letterSpacing = config[role]?.letterSpacing || 'normal';
    const weight = config[role]?.fontWeight || 'normal';

    // Compute font dropdown items — memoized so switching between fonts doesn't re-filter GOOGLE_FONTS each render.
    const fontItems = useMemo(() => {
        const categoryMatch = role === 'handwriting' ? 'handwriting' : ['sans-serif', 'serif', 'display'];
        const base = GOOGLE_FONTS.filter((f) =>
            Array.isArray(categoryMatch) ? categoryMatch.includes(f.category) : f.category === categoryMatch,
        );
        // If the current family isn't in the list (custom import), surface it as a selectable item.
        const custom = GOOGLE_FONTS.some((f) => f.family === fontFam)
            ? []
            : [{ family: fontFam, category: Array.isArray(categoryMatch) ? 'sans-serif' : 'handwriting' }];
        return [...base, ...custom].map((f) => ({ id: f.family, name: f.family }));
    }, [fontFam, role]);

    const textPreviewMap = {
        heading: 'The quick brown fox jumps over the lazy dog',
        body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.',
        handwriting: 'Welcome! Your message here.',
    };

    const cssRoleDefaults = {
        heading: `"${fontFam}", system-ui, sans-serif`,
        body: `"${fontFam}", sans-serif`,
        handwriting: `"${fontFam}", cursive`,
    };

    return (
        <div className="rounded-lg bg-background p-4 ring-1 ring-border">
            <Label className="capitalize font-semibold block mb-4">
                {role} Typography {mode !== 'shared' && `(${mode})`}
            </Label>

            <div className="space-y-4">
                <div>
                    <Label className="text-muted-foreground">Font Family</Label>
                    <OttaSelect
                        mode="single"
                        items={fontItems}
                        value={{ id: fontFam, name: fontFam }}
                        onChange={(v) => onFontFamilyChange(mode, role, (v as OttaSelectItem)?.id ?? 'Inter')}
                        searchable
                        searchPlaceholder="Search fonts..."
                        placeholder={`Select ${role} font`}
                        className="mt-1.5"
                    />
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <Label className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Weight
                        </Label>
                        <NativeSelect
                            value={weight}
                            onChange={(e) => onUpdate(mode, role, { fontWeight: e.target.value })}
                            wrapperClassName="w-full mt-1"
                        >
                            <NativeSelectOption value="normal">Normal (400)</NativeSelectOption>
                            <NativeSelectOption value="medium">Medium (500)</NativeSelectOption>
                            <NativeSelectOption value="semibold">Semibold (600)</NativeSelectOption>
                            <NativeSelectOption value="bold">Bold (700)</NativeSelectOption>
                            <NativeSelectOption value="black">Black (900)</NativeSelectOption>
                        </NativeSelect>
                    </div>
                    <div>
                        <Label className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Line Height
                        </Label>
                        <NativeSelect
                            value={lineHeight}
                            onChange={(e) => onUpdate(mode, role, { lineHeight: e.target.value })}
                            wrapperClassName="w-full mt-1"
                        >
                            <NativeSelectOption value="tight">Tight</NativeSelectOption>
                            <NativeSelectOption value="normal">Normal</NativeSelectOption>
                            <NativeSelectOption value="relaxed">Relaxed</NativeSelectOption>
                            <NativeSelectOption value="loose">Loose</NativeSelectOption>
                        </NativeSelect>
                    </div>
                    <div>
                        <Label className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Spacing
                        </Label>
                        <NativeSelect
                            value={letterSpacing}
                            onChange={(e) => onUpdate(mode, role, { letterSpacing: e.target.value })}
                            wrapperClassName="w-full mt-1"
                        >
                            <NativeSelectOption value="tighter">Tighter</NativeSelectOption>
                            <NativeSelectOption value="tight">Tight</NativeSelectOption>
                            <NativeSelectOption value="normal">Normal</NativeSelectOption>
                            <NativeSelectOption value="wide">Wide</NativeSelectOption>
                            <NativeSelectOption value="wider">Wider</NativeSelectOption>
                        </NativeSelect>
                    </div>
                </div>

                <div
                    className="mt-4 rounded-lg bg-muted/40 p-4 text-foreground"
                    style={{
                        fontFamily: cssRoleDefaults[role],
                        fontWeight: weight,
                        lineHeight:
                            lineHeight === 'tight'
                                ? 1.1
                                : lineHeight === 'relaxed'
                                  ? 1.6
                                  : lineHeight === 'loose'
                                    ? 2
                                    : 1.5,
                        letterSpacing:
                            letterSpacing === 'tight'
                                ? '-0.025em'
                                : letterSpacing === 'tighter'
                                  ? '-0.05em'
                                  : letterSpacing === 'wide'
                                    ? '0.025em'
                                    : letterSpacing === 'wider'
                                      ? '0.05em'
                                      : 'normal',
                        fontSize: role === 'heading' ? '1.5rem' : role === 'handwriting' ? '1.25rem' : '0.875rem',
                    }}
                >
                    {textPreviewMap[role]}
                </div>
            </div>
        </div>
    );
}

interface BrandKitFontsTabProps {
    tokensJson: string;
    themePresetId: string | null;
    onTokensChange: (tokensJson: string) => void;
    /** When true, wrap section in an override toggle (inherited kit) */
    hasParent?: boolean;
}

export function BrandKitFontsTab({ tokensJson, themePresetId, onTokensChange, hasParent }: BrandKitFontsTabProps) {
    const presetTypo = getThemeOrDefault(themePresetId || 'verdant').tokens?.typography;

    const parsed = useMemo(() => {
        try {
            const p = JSON.parse(tokensJson || '{}');
            return p.typography || {};
        } catch {
            return {};
        }
    }, [tokensJson]);

    // Check if typography is split into light/dark mode
    const isSplitMode = useMemo(() => {
        return Boolean(parsed.light || parsed.dark);
    }, [parsed]);

    const activeLight = isSplitMode ? parsed.light || {} : parsed;
    const activeDark = isSplitMode ? parsed.dark || activeLight : activeLight;

    // Load selected fonts for preview
    useEffect(() => {
        const urls: string[] = [];
        const processRole = (roleConfig: any) => {
            if (roleConfig?.url) urls.push(roleConfig.url);
        };
        if (isSplitMode) {
            processRole(parsed.light?.heading);
            processRole(parsed.light?.body);
            processRole(parsed.light?.handwriting);
            processRole(parsed.dark?.heading);
            processRole(parsed.dark?.body);
            processRole(parsed.dark?.handwriting);
        } else {
            processRole(parsed?.heading);
            processRole(parsed?.body);
            processRole(parsed?.handwriting);
        }
        urls.forEach((url) => injectFont(url));
    }, [parsed, isSplitMode]);

    const hasTypographyOverride = Object.keys(parsed).length > 0;

    const handleOverrideToggle = useCallback(
        (enabled: boolean) => {
            if (enabled) return;
            try {
                const p = JSON.parse(tokensJson || '{}');
                delete p.typography;
                onTokensChange(JSON.stringify(p, null, 2));
            } catch {
                onTokensChange('{}');
            }
        },
        [tokensJson, onTokensChange],
    );

    const handleSplitModeToggle = useCallback(
        (enabled: boolean) => {
            try {
                const p = JSON.parse(tokensJson || '{}');
                if (!enabled) {
                    // Revert to shared mode, taking light as truth
                    const lightConfig = p.typography?.light || {};
                    p.typography = { ...lightConfig };
                } else {
                    // Split into light and dark
                    const baseConfig = p.typography || {};
                    p.typography = {
                        light: { ...baseConfig },
                        dark: { ...baseConfig },
                    };
                }
                onTokensChange(JSON.stringify(p, null, 2));
            } catch {
                // Ignore parse errors on manual overrides
            }
        },
        [tokensJson, onTokensChange],
    );

    const handleUpdate = (
        mode: 'light' | 'dark' | 'shared',
        role: 'heading' | 'body' | 'handwriting',
        updates: Partial<TokenTypography>,
    ) => {
        try {
            const p = JSON.parse(tokensJson || '{}');
            p.typography = p.typography || {};

            if (mode === 'shared') {
                p.typography[role] = { ...(p.typography[role] || {}), ...updates };
            } else {
                p.typography[mode] = p.typography[mode] || {};
                p.typography[mode][role] = { ...(p.typography[mode][role] || {}), ...updates };
            }
            onTokensChange(JSON.stringify(p, null, 2));
        } catch {}
    };

    const handleFontFamilyChange = (
        mode: 'light' | 'dark' | 'shared',
        role: 'heading' | 'body' | 'handwriting',
        family: string,
    ) => {
        const typo = fontToTypography(family, role);
        handleUpdate(mode, role, typo);
    };

    const fontEditor = (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Typography</CardTitle>
                <CardDescription className="leading-relaxed">
                    Select Google Fonts, weights, and spacing for your brand. Advanced configurations can be split by
                    color mode.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg bg-background p-4 ring-1 ring-border">
                    <div>
                        <Label>Different for dark mode</Label>
                        <p className="text-xs text-muted-foreground">
                            Allows separate font weights or families for light vs dark mode.
                        </p>
                    </div>
                    <Switch checked={isSplitMode} onCheckedChange={handleSplitModeToggle} />
                </div>

                {!isSplitMode ? (
                    <div className="space-y-4">
                        <FontRoleEditor
                            mode="shared"
                            role="heading"
                            config={activeLight}
                            presetTypo={presetTypo}
                            onUpdate={handleUpdate}
                            onFontFamilyChange={handleFontFamilyChange}
                        />
                        <FontRoleEditor
                            mode="shared"
                            role="body"
                            config={activeLight}
                            presetTypo={presetTypo}
                            onUpdate={handleUpdate}
                            onFontFamilyChange={handleFontFamilyChange}
                        />
                        <FontRoleEditor
                            mode="shared"
                            role="handwriting"
                            config={activeLight}
                            presetTypo={presetTypo}
                            onUpdate={handleUpdate}
                            onFontFamilyChange={handleFontFamilyChange}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <FontRoleEditor
                                mode="light"
                                role="heading"
                                config={activeLight}
                                presetTypo={presetTypo}
                                onUpdate={handleUpdate}
                                onFontFamilyChange={handleFontFamilyChange}
                            />
                            <FontRoleEditor
                                mode="light"
                                role="body"
                                config={activeLight}
                                presetTypo={presetTypo}
                                onUpdate={handleUpdate}
                                onFontFamilyChange={handleFontFamilyChange}
                            />
                            <FontRoleEditor
                                mode="light"
                                role="handwriting"
                                config={activeLight}
                                presetTypo={presetTypo}
                                onUpdate={handleUpdate}
                                onFontFamilyChange={handleFontFamilyChange}
                            />
                        </div>
                        <div className="space-y-4">
                            <FontRoleEditor
                                mode="dark"
                                role="heading"
                                config={activeDark}
                                presetTypo={presetTypo}
                                onUpdate={handleUpdate}
                                onFontFamilyChange={handleFontFamilyChange}
                            />
                            <FontRoleEditor
                                mode="dark"
                                role="body"
                                config={activeDark}
                                presetTypo={presetTypo}
                                onUpdate={handleUpdate}
                                onFontFamilyChange={handleFontFamilyChange}
                            />
                            <FontRoleEditor
                                mode="dark"
                                role="handwriting"
                                config={activeDark}
                                presetTypo={presetTypo}
                                onUpdate={handleUpdate}
                                onFontFamilyChange={handleFontFamilyChange}
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    if (!hasParent) return <div className="space-y-6">{fontEditor}</div>;

    return (
        <div className="space-y-6">
            <OverrideSection label="Typography" isOverridden={hasTypographyOverride} onToggle={handleOverrideToggle}>
                {fontEditor}
            </OverrideSection>
        </div>
    );
}
