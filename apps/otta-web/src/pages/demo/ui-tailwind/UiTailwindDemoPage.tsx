/**
 * Tailwind Preset Demo Page
 * Demonstrates @ottabase/ui-tailwind: shared Tailwind preset with theme CSS variables.
 */
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { Moon, Paintbrush, Palette, Sun } from 'lucide-react';

/** Groups of CSS variable tokens the preset maps to Tailwind utilities. */
const TOKEN_GROUPS = [
    {
        label: 'Core Colors',
        tokens: [
            { name: '--background', tw: 'bg-background', desc: 'Page background' },
            { name: '--foreground', tw: 'text-foreground', desc: 'Default text' },
            { name: '--primary', tw: 'bg-primary', desc: 'Primary brand color' },
            { name: '--primary-foreground', tw: 'text-primary-foreground', desc: 'Text on primary' },
            { name: '--secondary', tw: 'bg-secondary', desc: 'Secondary fills' },
            { name: '--muted', tw: 'bg-muted', desc: 'Muted / subdued areas' },
            { name: '--accent', tw: 'bg-accent', desc: 'Accent highlights' },
            { name: '--destructive', tw: 'bg-destructive', desc: 'Error / danger' },
        ],
    },
    {
        label: 'UI Chrome',
        tokens: [
            { name: '--card', tw: 'bg-card', desc: 'Card surface' },
            { name: '--popover', tw: 'bg-popover', desc: 'Popover surface' },
            { name: '--border', tw: 'border-border', desc: 'Default border' },
            { name: '--input', tw: 'border-input', desc: 'Input border' },
            { name: '--ring', tw: 'ring-ring', desc: 'Focus ring' },
        ],
    },
    {
        label: 'Sidebar',
        tokens: [
            { name: '--sidebar-background', tw: 'bg-sidebar', desc: 'Sidebar bg' },
            { name: '--sidebar-foreground', tw: 'text-sidebar-foreground', desc: 'Sidebar text' },
            { name: '--sidebar-primary', tw: 'bg-sidebar-primary', desc: 'Sidebar active item' },
            { name: '--sidebar-accent', tw: 'bg-sidebar-accent', desc: 'Sidebar hover' },
            { name: '--sidebar-border', tw: 'border-sidebar-border', desc: 'Sidebar border' },
        ],
    },
    {
        label: 'Charts',
        tokens: [
            { name: '--chart-1', tw: 'text-chart-1', desc: 'Chart color 1' },
            { name: '--chart-2', tw: 'text-chart-2', desc: 'Chart color 2' },
            { name: '--chart-3', tw: 'text-chart-3', desc: 'Chart color 3' },
            { name: '--chart-4', tw: 'text-chart-4', desc: 'Chart color 4' },
            { name: '--chart-5', tw: 'text-chart-5', desc: 'Chart color 5' },
        ],
    },
];

/** Read the resolved CSS variable value from :root. */
function getCSSVar(name: string): string {
    if (typeof window === 'undefined') return '';
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function TokenSwatch({ name, tw, desc }: { name: string; tw: string; desc: string }) {
    const value = getCSSVar(name);
    return (
        <div className="flex items-center gap-3 rounded-lg border p-3">
            <div
                className="h-8 w-8 shrink-0 rounded-md border"
                style={{ backgroundColor: value ? `hsl(${value})` : 'transparent' }}
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <code className="text-xs font-medium">{name}</code>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{desc}</span>
                    <span>·</span>
                    <code>{tw}</code>
                </div>
            </div>
        </div>
    );
}

export function UiTailwindDemoPage() {
    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <Button asChild variant="ghost" className="w-fit text-muted-foreground hover:text-foreground">
                    <Link to="/demo">← Back to Demo Gallery</Link>
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="uppercase">
                        @ottabase/ui-tailwind
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-tight dark:text-foreground">Tailwind Preset Demo</h1>
                </div>
                <p className="max-w-3xl text-muted-foreground">
                    Shared Tailwind CSS preset that maps HSL CSS variables (shadcn-style tokens) to Tailwind utilities.
                    All colors, radii, fonts, chart tokens, and sidebar tokens are defined centrally.
                </p>
            </div>

            {/* Overview */}
            <Card className="border-primary/30 bg-primary/5 dark:border-primary/20 dark:bg-primary/10">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Paintbrush className="h-5 w-5" />
                        How It Works
                    </CardTitle>
                    <div className="text-sm text-muted-foreground space-y-2">
                        <p>
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">@ottabase/ui-tailwind</code> exports
                            a Tailwind <strong>preset</strong> that maps CSS variables to utility classes. The variables
                            are set by BrandEngine at runtime (or by your CSS theme file).
                        </p>
                        <p>
                            This means components only use Tailwind utilities like{' '}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">bg-primary</code>,{' '}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">text-muted-foreground</code>, etc.
                            The actual color values are resolved from CSS variables, enabling dynamic theming and
                            dark/light mode.
                        </p>
                    </div>
                </CardHeader>
            </Card>

            {/* Setup */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Setup</CardTitle>
                    <CardDescription>Add the preset to your Tailwind config.</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                        <code>{`// tailwind.config.cjs
const sharedPreset = require('@ottabase/ui-tailwind/tailwind.base.cjs');

module.exports = {
    darkMode: sharedPreset.darkMode,
    presets: [sharedPreset],
    content: ['./src/**/*.{js,ts,jsx,tsx}'],
};`}</code>
                    </pre>
                </CardContent>
            </Card>

            {/* Live token swatches */}
            {TOKEN_GROUPS.map((group) => (
                <Card key={group.label}>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Palette className="h-4 w-4" />
                            {group.label}
                        </CardTitle>
                        <CardDescription>
                            Live-resolved values from CSS variables. Toggle dark mode to see changes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {group.tokens.map((t) => (
                                <TokenSwatch key={t.name} {...t} />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}

            {/* Dark mode */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        <Moon className="h-4 w-4" />
                        Dark Mode
                    </CardTitle>
                    <CardDescription>
                        The preset configures <code>darkMode: ['class']</code> so dark mode is controlled via the{' '}
                        <code>.dark</code> class on <code>&lt;html&gt;</code>. BrandEngine and next-themes handle this
                        automatically.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-border bg-background p-4 text-foreground">
                            <p className="text-sm font-medium text-foreground">Light context</p>
                            <p className="text-xs text-muted-foreground">
                                Utilities like <code className="rounded bg-muted px-1">bg-background</code> read from
                                current theme variables.
                            </p>
                        </div>
                        <div className="rounded-lg border border-border p-1" aria-label="Dark theme token preview">
                            <div className="dark rounded-md border border-border bg-background p-4 text-foreground">
                                <p className="text-sm font-medium text-foreground">Dark context (local .dark)</p>
                                <p className="text-xs text-muted-foreground">
                                    Same class names as the light panel; only the CSS variable values differ. Toggle
                                    global theme to compare with the live app chrome.
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
