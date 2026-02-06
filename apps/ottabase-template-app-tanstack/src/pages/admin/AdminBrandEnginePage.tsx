import { useTheme } from '@/ottabase/providers/ThemeContext';
import { getAvailableThemes } from '@/ottabase/utils/theme.loader';
import type { ContentWidth, Density, HeaderVariant, LayoutConfig, NavigationVariant } from '@ottabase/brand-engine';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Label,
    Separator,
} from '@ottabase/ui-shadcn';
import { Check, Columns3, Layout, Monitor, Moon, Paintbrush, RotateCcw, Sun, Type } from 'lucide-react';
import { useTheme as useNextTheme } from 'next-themes';

// ---------------------------------------------------------------------------
// Option selector component
// ---------------------------------------------------------------------------

interface OptionSelectorProps<T extends string> {
    label: string;
    description?: string;
    options: { value: T; label: string; description?: string }[];
    value: T;
    onChange: (value: T) => void;
}

function OptionSelector<T extends string>({ label, description, options, value, onChange }: OptionSelectorProps<T>) {
    return (
        <div className="space-y-2">
            <Label className="text-sm font-medium">{label}</Label>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {options.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className={`relative rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                            value === opt.value
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                    >
                        <span className="font-medium">{opt.label}</span>
                        {opt.description && (
                            <span className="block text-xs text-muted-foreground mt-0.5">{opt.description}</span>
                        )}
                        {value === opt.value && <Check className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" />}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Toggle option
// ---------------------------------------------------------------------------

function ToggleOption({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <Label className="text-sm font-medium">{label}</Label>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    checked ? 'bg-primary' : 'bg-muted'
                }`}
            >
                <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform ${
                        checked ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Color swatch preview
// ---------------------------------------------------------------------------

function ColorSwatch({ name, value }: { name: string; value: string }) {
    return (
        <div className="flex items-center gap-2">
            <div
                className="h-6 w-6 rounded border border-border shrink-0"
                style={{ backgroundColor: `hsl(${value})` }}
            />
            <div className="min-w-0">
                <span className="text-xs font-medium truncate block">{name}</span>
                <span className="text-[10px] text-muted-foreground truncate block">{value}</span>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// AdminBrandEnginePage
// ---------------------------------------------------------------------------

export function AdminBrandEnginePage() {
    const {
        theme: themeName,
        setTheme,
        resolved,
        layout,
        layoutOverrides,
        setLayoutOverrides,
        resetLayoutOverrides,
    } = useTheme();
    const { resolvedTheme, setTheme: setMode } = useNextTheme();
    const availableThemes = getAvailableThemes();

    const currentLayout = layout ?? {
        header: 'topbar' as HeaderVariant,
        navigation: 'topbar' as NavigationVariant,
        contentWidth: 'fixed' as ContentWidth,
        footer: true,
        density: 'comfy' as Density,
    };

    const hasOverrides = Object.keys(layoutOverrides).length > 0;

    // Helper to update a single layout field
    const updateLayoutField = <K extends keyof LayoutConfig>(key: K, value: LayoutConfig[K]) => {
        setLayoutOverrides({ ...layoutOverrides, [key]: value });
    };

    // Core color tokens to preview
    const coreColors = [
        'background',
        'foreground',
        'primary',
        'primary-foreground',
        'secondary',
        'muted',
        'accent',
        'destructive',
        'border',
        'card',
        'sidebar-background',
    ];

    return (
        <div className="space-y-8">
            {/* Page header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">BrandEngine</h1>
                <p className="text-muted-foreground mt-1">
                    Theme, layout, and design token configuration. Changes apply in real-time.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* ----------------------------------------------------------------
                    Theme Selection
                ---------------------------------------------------------------- */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Paintbrush className="h-4 w-4" />
                            Theme
                        </CardTitle>
                        <CardDescription>
                            Select a bundled theme. Each theme includes its own color palette, typography, spacing, and
                            default layout.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {availableThemes.map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTheme(t)}
                                    className={`relative rounded-md border px-3 py-2.5 text-sm capitalize transition-colors ${
                                        themeName === t
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary font-medium'
                                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                    }`}
                                >
                                    {t}
                                    {themeName === t && (
                                        <Check className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-primary" />
                                    )}
                                </button>
                            ))}
                        </div>

                        <Separator />

                        {/* Dark/Light mode */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Color Mode</Label>
                            <div className="flex gap-2">
                                <Button
                                    variant={resolvedTheme === 'light' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setMode('light')}
                                >
                                    <Sun className="h-4 w-4 mr-1.5" />
                                    Light
                                </Button>
                                <Button
                                    variant={resolvedTheme === 'dark' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setMode('dark')}
                                >
                                    <Moon className="h-4 w-4 mr-1.5" />
                                    Dark
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setMode('system')}>
                                    <Monitor className="h-4 w-4 mr-1.5" />
                                    System
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ----------------------------------------------------------------
                    Layout Configuration
                ---------------------------------------------------------------- */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Layout className="h-4 w-4" />
                            Layout
                            {hasOverrides && (
                                <Badge variant="secondary" className="ml-auto text-xs">
                                    Overridden
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription>
                            Override the theme's default layout. These overrides persist across theme switches.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <OptionSelector<HeaderVariant>
                            label="Header"
                            options={[
                                { value: 'topbar', label: 'Topbar', description: 'Full header' },
                                { value: 'minimal', label: 'Minimal', description: 'Compact' },
                                { value: 'sidebar', label: 'Sidebar', description: 'Sidebar header' },
                                { value: 'none', label: 'None', description: 'No header' },
                            ]}
                            value={currentLayout.header}
                            onChange={(v) => updateLayoutField('header', v)}
                        />

                        <OptionSelector<NavigationVariant>
                            label="Navigation"
                            options={[
                                { value: 'topbar', label: 'Topbar', description: 'In header' },
                                { value: 'sidebar', label: 'Sidebar', description: 'Left panel' },
                                { value: 'drawer', label: 'Drawer', description: 'Hamburger menu' },
                            ]}
                            value={currentLayout.navigation}
                            onChange={(v) => updateLayoutField('navigation', v)}
                        />

                        <OptionSelector<ContentWidth>
                            label="Content Width"
                            options={[
                                { value: 'fixed', label: 'Fixed', description: 'max-w-5xl' },
                                { value: 'fluid', label: 'Fluid', description: 'max-w-7xl' },
                                { value: 'full', label: 'Full', description: '100% width' },
                            ]}
                            value={currentLayout.contentWidth}
                            onChange={(v) => updateLayoutField('contentWidth', v)}
                        />

                        <OptionSelector<Density>
                            label="Density"
                            options={[
                                { value: 'comfy', label: 'Comfortable', description: 'Spacious' },
                                { value: 'compact', label: 'Compact', description: 'Tight' },
                            ]}
                            value={currentLayout.density}
                            onChange={(v) => updateLayoutField('density', v)}
                        />

                        <ToggleOption
                            label="Footer"
                            description="Show footer at the bottom of the page"
                            checked={currentLayout.footer}
                            onChange={(v) => updateLayoutField('footer', v)}
                        />

                        {hasOverrides && (
                            <Button variant="outline" size="sm" onClick={resetLayoutOverrides} className="w-full">
                                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                Reset to Theme Defaults
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* ----------------------------------------------------------------
                    Typography Preview
                ---------------------------------------------------------------- */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Type className="h-4 w-4" />
                            Typography
                        </CardTitle>
                        <CardDescription>Current font families from the active theme.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {resolved && (
                            <>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Heading</Label>
                                    <p
                                        className="text-2xl font-bold"
                                        style={{ fontFamily: resolved.typography.heading.fontFamily }}
                                    >
                                        {resolved.typography.heading.fontFamily}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Body</Label>
                                    <p
                                        className="text-base"
                                        style={{ fontFamily: resolved.typography.body.fontFamily }}
                                    >
                                        {resolved.typography.body.fontFamily} – The quick brown fox jumps over the lazy
                                        dog.
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Handwriting</Label>
                                    <p
                                        className="text-lg"
                                        style={{ fontFamily: resolved.typography.handwriting.fontFamily }}
                                    >
                                        {resolved.typography.handwriting.fontFamily}
                                    </p>
                                </div>

                                <Separator />

                                <div className="grid grid-cols-3 gap-3 text-xs">
                                    <div>
                                        <span className="text-muted-foreground">Radius</span>
                                        <p className="font-mono font-medium">{resolved.radius}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Spacing (section)</span>
                                        <p className="font-mono font-medium">{resolved.spacing?.section ?? '—'}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Motion (normal)</span>
                                        <p className="font-mono font-medium">{resolved.motion.durationNormal}</p>
                                    </div>
                                </div>
                            </>
                        )}
                        {!resolved && <p className="text-sm text-muted-foreground">Resolving theme...</p>}
                    </CardContent>
                </Card>

                {/* ----------------------------------------------------------------
                    Color Palette Preview
                ---------------------------------------------------------------- */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Paintbrush className="h-4 w-4" />
                            Color Palette
                        </CardTitle>
                        <CardDescription>
                            Active color tokens ({resolvedTheme} mode). Values are HSL channels.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {resolved && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {coreColors.map((name) => {
                                    const val = (resolved.colors as Record<string, string>)[name];
                                    return val ? <ColorSwatch key={name} name={name} value={val} /> : null;
                                })}
                            </div>
                        )}
                        {!resolved && <p className="text-sm text-muted-foreground">Resolving theme...</p>}
                    </CardContent>
                </Card>

                {/* ----------------------------------------------------------------
                    Active Configuration Summary
                ---------------------------------------------------------------- */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Columns3 className="h-4 w-4" />
                            Active Configuration
                        </CardTitle>
                        <CardDescription>Summary of all resolved design tokens and layout settings.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground text-xs">Theme</span>
                                <p className="font-medium capitalize">{themeName}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Mode</span>
                                <p className="font-medium capitalize">{resolvedTheme}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Header</span>
                                <p className="font-medium capitalize">{currentLayout.header}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Navigation</span>
                                <p className="font-medium capitalize">{currentLayout.navigation}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Content Width</span>
                                <p className="font-medium capitalize">{currentLayout.contentWidth}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Density</span>
                                <p className="font-medium capitalize">{currentLayout.density}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Footer</span>
                                <p className="font-medium">{currentLayout.footer ? 'Visible' : 'Hidden'}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Heading Font</span>
                                <p className="font-medium">{resolved?.typography.heading.fontFamily ?? '—'}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Body Font</span>
                                <p className="font-medium">{resolved?.typography.body.fontFamily ?? '—'}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Border Radius</span>
                                <p className="font-mono font-medium">{resolved?.radius ?? '—'}</p>
                            </div>
                        </div>

                        {hasOverrides && (
                            <div className="mt-4 p-3 rounded-md bg-muted/50 border text-xs">
                                <span className="font-medium">Layout overrides active:</span>{' '}
                                {Object.entries(layoutOverrides)
                                    .map(([k, v]) => `${k}=${String(v)}`)
                                    .join(', ')}
                            </div>
                        )}

                        {/* Shadow preview */}
                        {resolved && (
                            <div className="mt-6">
                                <span className="text-muted-foreground text-xs">Shadow Scale</span>
                                <div className="flex gap-4 mt-2">
                                    {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((level) => (
                                        <div
                                            key={level}
                                            className="h-12 w-12 rounded-md bg-card border"
                                            style={{ boxShadow: resolved.shadows[level] }}
                                            title={`shadow-${level}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
