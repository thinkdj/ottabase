import { LAYOUT_PRESETS, LAYOUT_PRESET_IDS, type LayoutPresetId } from '@ottabase/ottalayout';
import { useLayoutMeta } from '@ottabase/ottalayout/react';
import { Button } from '@ottabase/ui-shadcn';
import { cn } from '@ottabase/ui-shadcn/lib/utils';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

// Plain string like DemoLayout's links: /demo children are built via addChildren and aren't in the typed route union.
const LAYOUT_DEMO_PATH: string = '/demo/layout';

function isPresetId(value: string | undefined): value is LayoutPresetId {
    return !!value && (LAYOUT_PRESET_IDS as string[]).includes(value);
}

/**
 * /layout-preview/$preset — each URL pins one built-in preset for itself via useLayoutMeta,
 * so moving between preview URLs swaps the whole app shell, and leaving the preview restores
 * the route's normal layout. Page-level only: no layout rules are written, nothing else changes.
 */
export function LayoutPreviewPage() {
    const { preset } = useParams({ strict: false }) as { preset?: string };
    const id: LayoutPresetId = isPresetId(preset) ? preset : 'app-shell';
    const config = LAYOUT_PRESETS[id].config;

    // Page meta is merged over the route's own layout, so pin the fields presets leave unset to the
    // shell defaults; otherwise a preview would inherit e.g. centerContent from whatever /** maps to.
    useLayoutMeta({ centerContent: false, containerPadding: 'md', ...config });

    return (
        <div className="space-y-6">
            {/* Inline, top of content: always reachable (minimal/fullscreen drop header + nav) without
                covering the footer the way a fixed bar would. Scrolls horizontally on narrow screens. */}
            <nav aria-label="Layout presets" className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1">
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                    <Link to={LAYOUT_DEMO_PATH}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Link>
                </Button>
                {LAYOUT_PRESET_IDS.map((presetId) => (
                    <Button
                        key={presetId}
                        asChild
                        size="sm"
                        variant={presetId === id ? 'default' : 'ghost'}
                        className={cn('shrink-0', presetId !== id && 'text-muted-foreground')}
                    >
                        <Link to="/layout-preview/$preset" params={{ preset: presetId }}>
                            {presetId}
                        </Link>
                    </Button>
                ))}
            </nav>

            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Layout preview
                </p>
                <h1 className="mt-1 text-2xl font-semibold">{id}</h1>
                {!isPresetId(preset) && (
                    <p className="mt-2 text-sm text-muted-foreground">
                        Unknown preset <code>{preset}</code>; showing <code>app-shell</code>.
                    </p>
                )}
                <p className="mt-2 text-sm text-muted-foreground">
                    Header, navigation, content width, density and footer below all come from this preset.
                </p>
            </div>

            <pre className="overflow-auto rounded-lg bg-muted/40 p-3 text-xs ring-1 ring-border">
                {JSON.stringify(config, null, 2)}
            </pre>

            {/* Filler so content width, density and footer placement are visible */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="h-24 rounded-lg bg-muted/40 ring-1 ring-border" />
                ))}
            </div>
        </div>
    );
}
