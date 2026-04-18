import { useTheme } from '@/ottabase/providers/ThemeContext';
import {
    buildCSSVarMap,
    getThemeOrDefault,
    injectFont,
    resolveTheme,
    THEME_PRESET_ITEMS,
} from '@ottabase/brand-engine';
import { OttaSelect, type OttaSelectItem } from '@ottabase/ottaselect';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Input,
    Label,
} from '@ottabase/ui-shadcn';
import { useTheme as useNextTheme } from 'next-themes';
import { useEffect, useMemo, useRef, useState } from 'react';

const stringifyTokenValue = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value === null || value === undefined) return '—';
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const hslToCss = (hsl: string): string => {
    const base = hsl.split('/')[0].trim();
    const parts = base
        .split(/\s+/)
        .map((v) => parseFloat(v))
        .filter((n) => !Number.isNaN(n));
    if (parts.length < 3) return 'hsl(221, 83%, 53%)';
    return `hsl(${parts[0]}, ${parts[1]}%, ${parts[2]}%)`;
};

function ColorSwatch({ color, className }: { color: string; className: string }) {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!ref.current) return;
        ref.current.style.backgroundColor = color;
    }, [color]);

    return <div ref={ref} className={className} />;
}

export function ThemingDemoPage() {
    const { theme } = useTheme();
    const { resolvedTheme } = useNextTheme();
    const [previewMode, setPreviewMode] = useState<'light' | 'dark'>(resolvedTheme === 'dark' ? 'dark' : 'light');
    const [localThemeName, setLocalThemeName] = useState(theme || 'default');

    const themePresetItems = useMemo(
        () =>
            THEME_PRESET_ITEMS.map((item) => ({
                id: item.id,
                name: item.name,
                colors: [...item.colors],
            })),
        [],
    );

    const selectedPresetItem = useMemo(
        () => themePresetItems.find((item) => item.id === localThemeName) ?? themePresetItems[0],
        [themePresetItems, localThemeName],
    );

    const previewResolved = useMemo(
        () =>
            resolveTheme({
                base: getThemeOrDefault(localThemeName || 'default'),
                mode: previewMode,
            }),
        [localThemeName, previewMode],
    );

    const previewVars = useMemo(() => buildCSSVarMap(previewResolved), [previewResolved]);
    const previewLayerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!previewLayerRef.current) return;
        // Apply CSS variables to the scoped preview container
        for (const [key, value] of Object.entries(previewVars)) {
            previewLayerRef.current.style.setProperty(key, String(value));
        }
        // Load Google Font stylesheets for the selected theme so font-handwriting
        // (and heading/body) actually render the correct typeface in the preview
        const typo = previewResolved?.typography;
        if (typo) {
            [typo.heading?.url, typo.body?.url, typo.handwriting?.url]
                .filter(Boolean)
                .forEach((url) => injectFont(url as string));
        }
    }, [previewVars, previewResolved]);

    return (
        <div className="space-y-theme-section animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Theming Configurator</h1>
                <p className="text-muted-foreground">
                    Theme can be set per app (or per route!) by the admin in Brand Engine. Use the control stack to tune
                    the local preview.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[320px_1fr] items-start">
                <div className="space-y-4">
                    <Card className="border-dashed">
                        <CardHeader>
                            <CardTitle>
                                Theme Switcher
                                <small className="block py-1">(Local, Preview)</small>
                            </CardTitle>
                            <CardDescription>
                                Demo-only preset switcher. Updates the preview canvas only.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <OttaSelect
                                mode="single"
                                items={themePresetItems}
                                value={selectedPresetItem ? ({ ...selectedPresetItem } as OttaSelectItem) : null}
                                onChange={(value) => {
                                    const nextTheme = (value as OttaSelectItem | null)?.id || 'default';
                                    setLocalThemeName(nextTheme);
                                }}
                                placeholder="Select theme preset"
                                searchable={false}
                                clearable={false}
                                renderItem={({ item }) => (
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="flex items-center gap-1">
                                            {(
                                                ((item as OttaSelectItem & { colors?: string[] }).colors as string[]) ??
                                                []
                                            )
                                                .slice(0, 5)
                                                .map((color, index) => (
                                                    <ColorSwatch
                                                        key={`${item.id}-chip-${index}`}
                                                        className="h-4 w-4 rounded border border-border"
                                                        color={hslToCss(color)}
                                                    />
                                                ))}
                                        </div>
                                        <span className="truncate font-medium">{item.name}</span>
                                    </div>
                                )}
                                renderValue={(item) => (
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex items-center gap-1 shrink-0">
                                            {(
                                                ((item as OttaSelectItem & { colors?: string[] }).colors as string[]) ??
                                                []
                                            )
                                                .slice(0, 5)
                                                .map((color, index) => (
                                                    <ColorSwatch
                                                        key={`selected-chip-${index}`}
                                                        className="h-4 w-4 rounded border border-border"
                                                        color={hslToCss(color)}
                                                    />
                                                ))}
                                        </div>
                                        <span className="truncate font-medium">{(item as OttaSelectItem).name}</span>
                                    </div>
                                )}
                                className="w-full"
                            />
                            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm hidden">
                                <span className="text-muted-foreground">Selected preset</span>
                                <span className="font-medium">{selectedPresetItem?.name ?? 'Default'}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                                <span className="text-xs text-muted-foreground">Preview mode</span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant={previewMode === 'light' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setPreviewMode('light')}
                                    >
                                        Light
                                    </Button>
                                    <Button
                                        variant={previewMode === 'dark' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setPreviewMode('dark')}
                                    >
                                        Dark
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Active theme
                                <small className="block py-1">(Global)</small>
                            </CardTitle>
                            <CardDescription>App-level preset (admin-configured) for current app.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="font-mono text-sm capitalize">{theme || 'default'}</p>
                        </CardContent>
                    </Card>
                </div>

                <div
                    ref={previewLayerRef}
                    className="space-y-theme-element rounded-2xl border bg-background/80 p-4 shadow-sm"
                >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">Local Preview Canvas</h2>
                            <p className="text-sm text-muted-foreground">
                                Everything inside responds to the selected preset and mode.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="rounded-full border bg-muted/60 px-2 py-1">Live preview</span>
                            <span className="font-medium text-foreground">{selectedPresetItem?.name ?? 'Default'}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="capitalize">{previewMode} mode</span>
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Typography Check</CardTitle>
                            <CardDescription>View local preview typography and spacing configuration.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground w-16">Heading:</span>
                                    <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                                        {previewResolved?.typography?.heading?.fontFamily ?? '—'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground w-16">Body:</span>
                                    <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                                        {previewResolved?.typography?.body?.fontFamily ?? '—'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground w-16">Cursive:</span>
                                    <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                                        {previewResolved?.typography?.handwriting?.fontFamily ?? '—'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground w-16">Vars:</span>
                                    <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                                        H:{previewResolved?.typography?.heading?.fontFamily ?? '—'} / B:
                                        {previewResolved?.typography?.body?.fontFamily ?? '—'} / C:
                                        {previewResolved?.typography?.handwriting?.fontFamily ?? '—'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1 pt-4 border-t">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground w-16">Radius:</span>
                                    <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                                        {previewResolved?.radius ?? '—'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground w-16">Spacing:</span>
                                    <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                                        {previewResolved?.spacing?.section || 'N/A'} (Sec) /{' '}
                                        {previewResolved?.spacing?.card || 'N/A'} (Card)
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                        <CardContent className="space-y-4">
                            <div>
                                <h1 className="font-heading text-4xl font-extrabold lg:text-5xl">Heading 1</h1>
                                <h2 className="font-heading text-3xl font-semibold mt-3">Heading 2</h2>
                                <h3 className="font-heading text-2xl font-semibold mt-3">Heading 3</h3>
                                <p className="leading-7 [&:not(:first-child)]:mt-6">
                                    The quick brown fox jumps over the lazy dog. This paragraph demonstrates the body
                                    font readability and line height settings derived from the base design system.
                                </p>
                                <div className="mt-8 p-6 bg-muted/50 rounded-lg text-center">
                                    <p className="font-handwriting text-3xl text-primary">
                                        "Design is intelligence made visible."
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-2">- Handwriting Font Demo</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Color Palette</CardTitle>
                            <CardDescription>Full resolved semantic color tokens for the active mode.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.entries(previewResolved?.colors ?? {}).map(([key, value]) => (
                                    <div key={key} className="space-y-1.5">
                                        <ColorSwatch
                                            className="h-12 w-full rounded border ring-offset-background transition-shadow hover:ring-2 hover:ring-ring hover:ring-offset-2"
                                            color={`hsl(${value})`}
                                        />
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-medium leading-none">{key}</p>
                                            <p className="text-xs text-muted-foreground">{value as string}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Brand Engine Tokens</CardTitle>
                            <CardDescription>
                                Expanded listing of spacing, shadows, motion, cursors, and typography.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-theme-card md:grid-cols-2">
                            <div className="space-y-3">
                                <p className="text-sm font-medium">Spacing</p>
                                <div className="space-y-1">
                                    {Object.entries(previewResolved?.spacing ?? {}).map(([key, value]) => (
                                        <div
                                            key={`spacing-${key}`}
                                            className="flex items-center justify-between gap-2 text-xs"
                                        >
                                            <span className="text-muted-foreground">{key}</span>
                                            <span className="font-mono">{stringifyTokenValue(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <p className="text-sm font-medium">Shadows</p>
                                <div className="space-y-1">
                                    {Object.entries(previewResolved?.shadows ?? {}).map(([key, value]) => (
                                        <div
                                            key={`shadow-${key}`}
                                            className="flex items-center justify-between gap-2 text-xs"
                                        >
                                            <span className="text-muted-foreground">{key}</span>
                                            <span className="font-mono text-right">{stringifyTokenValue(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <p className="text-sm font-medium">Motion</p>
                                <div className="space-y-1">
                                    {Object.entries(previewResolved?.motion ?? {}).map(([key, value]) => (
                                        <div
                                            key={`motion-${key}`}
                                            className="flex items-center justify-between gap-2 text-xs"
                                        >
                                            <span className="text-muted-foreground">{key}</span>
                                            <span className="font-mono">{stringifyTokenValue(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <p className="text-sm font-medium">Cursors</p>
                                <div className="space-y-1">
                                    {Object.entries(previewResolved?.cursors ?? {}).map(([key, value]) => (
                                        <div
                                            key={`cursor-${key}`}
                                            className="flex items-center justify-between gap-2 text-xs"
                                        >
                                            <span className="text-muted-foreground">{key}</span>
                                            <span className="font-mono">{stringifyTokenValue(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3 md:col-span-2">
                                <p className="text-sm font-medium">Typography</p>
                                <pre className="w-full overflow-auto rounded bg-muted p-3 text-xs">
                                    {JSON.stringify(previewResolved?.typography ?? {}, null, 2)}
                                </pre>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-theme-card md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Component Samples</CardTitle>
                                <CardDescription>Inputs, buttons, and form controls.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid w-full max-w-sm items-center gap-1.5">
                                    <Label htmlFor="email">Email</Label>
                                    <Input type="email" id="email" placeholder="Email" />
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    <Button>Primary</Button>
                                    <Button variant="secondary">Secondary</Button>
                                    <Button variant="destructive">Destructive</Button>
                                    <Button variant="outline">Outline</Button>
                                    <Button variant="ghost">Ghost</Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Interactive</CardTitle>
                                <CardDescription>Hover states and focus rings.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center space-x-2">
                                    <div className="h-10 w-10 rounded-full bg-primary animate-pulse" />
                                    <div className="space-y-1">
                                        <div className="h-4 w-[200px] rounded bg-muted animate-pulse" />
                                        <div className="h-3 w-[150px] rounded bg-muted animate-pulse" />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full">Action</Button>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
