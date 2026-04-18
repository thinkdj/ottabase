/**
 * UI Base Demo Page
 * Demonstrates @ottabase/ui-base: CSS reset, animations, and base provider.
 */
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { Layers, RotateCcw, Sparkles, Type } from 'lucide-react';

/** Tailwind animation utilities (work when Tailwind is present in the app). */
const TAILWIND_MOTION = [
    { name: 'pulse', class: 'animate-pulse', desc: 'Pulsing opacity (Tailwind)' },
    { name: 'spin', class: 'animate-spin', desc: 'Rotation (Tailwind)' },
    { name: 'bounce', class: 'animate-bounce', desc: 'Bounce (Tailwind)' },
];

/** Styles included in the base package. */
const STYLE_LAYERS = [
    {
        name: 'reset.css',
        desc: 'Browser-normalizing CSS reset. Eliminates default margins, paddings, and inconsistencies across browsers.',
        items: ['Box-sizing: border-box', 'Margin/padding reset', 'Font smoothing', 'Image/media defaults'],
    },
    {
        name: 'ottabase.css',
        desc: 'Core layout utilities and base typography styles shared across the platform.',
        items: ['Base font family', 'Line height defaults', 'Scrollbar styling', 'Print styles'],
    },
    {
        name: 'animations.css',
        desc: 'Keyframe utilities bundled with the base package (not full Tailwind).',
        items: [
            '@keyframes highlightBgFadeOut',
            '.highlight-and-fade-out-bg',
            '.highlight-red / .highlight-green / .highlight-blue',
        ],
    },
];

export function UiBaseDemoPage() {
    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <Button asChild variant="ghost" className="w-fit text-muted-foreground hover:text-foreground">
                    <Link to="/demo">← Back to Demo Gallery</Link>
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="uppercase">
                        @ottabase/ui-base
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-tight dark:text-foreground">UI Base Demo</h1>
                </div>
                <p className="max-w-3xl text-muted-foreground">
                    Framework-agnostic CSS foundation: reset, base styles, and animations. No React or Mantine
                    dependency — pure CSS that every app imports first.
                </p>
            </div>

            {/* Overview */}
            <Card className="border-primary/30 bg-primary/5 dark:border-primary/20 dark:bg-primary/10">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Layers className="h-5 w-5" />
                        Architecture
                    </CardTitle>
                    <div className="text-sm text-muted-foreground space-y-2">
                        <p>
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">@ottabase/ui-base</code> is the
                            lowest layer of the UI stack. It provides:
                        </p>
                        <ol className="list-inside list-decimal space-y-1">
                            <li>
                                <strong>ProviderUIBase</strong> — React provider that wraps children with base context
                                (font families, etc.).
                            </li>
                            <li>
                                <strong>Styles</strong> — CSS reset + ottabase base styles + animations, imported via{' '}
                                <code className="rounded bg-muted px-1 py-0.5 text-xs">@ottabase/ui-base/styles</code>.
                            </li>
                        </ol>
                        <p className="pt-1">
                            All other UI packages (<code>ui-shadcn</code>, <code>ui-mantine</code>,{' '}
                            <code>ui-components</code>) build on top of this base.
                        </p>
                    </div>
                </CardHeader>
            </Card>

            {/* Setup */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Setup</CardTitle>
                    <CardDescription>Import styles and wrap your app with the provider.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                        <code>{`// Import base styles (in your app entry point)
import '@ottabase/ui-base/styles';

// Wrap your app with the provider
import { ProviderUIBase } from '@ottabase/ui-base';

function App() {
    return (
        <ProviderUIBase fontFamilies={{ sans: 'Inter', mono: 'JetBrains Mono' }}>
            {children}
        </ProviderUIBase>
    );
}`}</code>
                    </pre>
                </CardContent>
            </Card>

            {/* Style layers */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Included Style Layers
                    </CardTitle>
                    <CardDescription>
                        Three CSS files bundled into <code>@ottabase/ui-base/styles</code>.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {STYLE_LAYERS.map((layer) => (
                            <div key={layer.name} className="rounded-lg border p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <code className="text-sm font-medium">{layer.name}</code>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">{layer.desc}</p>
                                <div className="flex flex-wrap gap-2">
                                    {layer.items.map((item) => (
                                        <Badge key={item} variant="secondary" className="text-xs">
                                            {item}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Animations: package CSS + Tailwind */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Animation Preview
                    </CardTitle>
                    <CardDescription>
                        <code>animations.css</code> ships highlight flash keyframes; motion utilities like{' '}
                        <code>animate-pulse</code> come from Tailwind in apps that use the shared preset.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div>
                        <h4 className="mb-3 text-sm font-medium text-foreground">
                            From @ottabase/ui-base (animations.css)
                        </h4>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-lg border p-4">
                                <p className="text-xs text-muted-foreground mb-3">
                                    <code>.highlight-and-fade-out-bg</code> — one-shot attention flash (re-triggers on
                                    remount)
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <span className="highlight-and-fade-out-bg rounded-md border border-border px-3 py-2 text-sm">
                                        Default
                                    </span>
                                    <span className="highlight-and-fade-out-bg highlight-red rounded-md border border-border px-3 py-2 text-sm">
                                        Red
                                    </span>
                                    <span className="highlight-and-fade-out-bg highlight-green rounded-md border border-border px-3 py-2 text-sm">
                                        Green
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 className="mb-3 text-sm font-medium text-foreground">Tailwind motion (demo app)</h4>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {TAILWIND_MOTION.map((anim) => (
                                <div key={anim.name} className="rounded-lg border border-border p-4 text-center">
                                    <div className="mb-3 flex h-16 items-center justify-center">
                                        <div
                                            className={`h-10 w-10 rounded-lg bg-primary ${anim.class}`}
                                            aria-hidden="true"
                                        />
                                    </div>
                                    <code className="text-xs font-medium">{anim.name}</code>
                                    <p className="text-xs text-muted-foreground mt-1">{anim.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Typography defaults */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        Typography Defaults
                    </CardTitle>
                    <CardDescription>
                        Base typography styles applied by the reset. Font families are configurable via{' '}
                        <code>ProviderUIBase</code>.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="rounded-lg border p-4">
                            <p className="text-4xl font-bold">Heading 1</p>
                            <p className="text-3xl font-bold mt-2">Heading 2</p>
                            <p className="text-2xl font-semibold mt-2">Heading 3</p>
                            <p className="text-xl font-semibold mt-2">Heading 4</p>
                            <p className="text-base mt-2">Body text — the quick brown fox jumps over the lazy dog.</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                Small / muted text for secondary information.
                            </p>
                            <p className="font-mono text-sm mt-2">
                                <code>Monospace text for code and technical content.</code>
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
