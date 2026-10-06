/**
 * The site, as a path would render it on a given config: the real header,
 * navigation, sidebar and footer around a sample page, scaled into a frame.
 * Inert, so nothing in it can be clicked or focused.
 */
import { ConfigurableLayout } from '@/ottabase/components/ConfigurableLayout';
import { buildCSSVarMap, injectFont } from '@ottabase/brand-engine';
import { BrandConfigProvider, type FullBrandConfig } from '@ottabase/brand-engine-react';
import { LayoutSlotsProvider } from '@ottabase/ottalayout/react';
import { Button, Card, CardContent } from '@ottabase/ui-shadcn';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { configForPath, layoutFor } from './siteDraft';

/** The site is laid out at a laptop width and scaled to the frame */
const VIRTUAL_WIDTH = 1024;
const VIRTUAL_HEIGHT = 720;

export interface SitePreviewProps {
    full: FullBrandConfig;
    path: string;
    mode: 'light' | 'dark';
}

export function SitePreview({ full, path, mode }: SitePreviewProps) {
    const config = useMemo(() => configForPath(full, path, mode), [full, path, mode]);
    const layout = useMemo(() => layoutFor(config), [config]);
    const vars = useMemo(() => (config ? buildCSSVarMap(config.theme, mode) : {}), [config, mode]);

    const typography = config?.theme.typography;
    useEffect(() => {
        [typography?.heading?.url, typography?.body?.url, typography?.handwriting?.url].forEach((url) => {
            if (url) injectFont(url);
        });
    }, [typography]);

    const frame = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.5);
    useLayoutEffect(() => {
        const el = frame.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / VIRTUAL_WIDTH));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div className="overflow-hidden rounded-xl bg-background ring-1 ring-border">
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
                <span className="flex gap-1" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                        <span key={i} className="h-2.5 w-2.5 rounded-full bg-border" />
                    ))}
                </span>
                <span className="truncate font-mono text-xs text-muted-foreground">{path}</span>
            </div>
            <div
                ref={frame}
                className="relative overflow-hidden"
                style={{ aspectRatio: `${VIRTUAL_WIDTH} / ${VIRTUAL_HEIGHT}` }}
            >
                {config ? (
                    <div
                        className={`site-preview-page ${mode === 'dark' ? 'dark' : ''}`}
                        style={
                            {
                                ...vars,
                                width: VIRTUAL_WIDTH,
                                height: VIRTUAL_HEIGHT,
                                transform: `scale(${scale})`,
                                transformOrigin: 'top left',
                                colorScheme: mode,
                                color: 'hsl(var(--foreground))',
                            } as CSSProperties
                        }
                        inert
                        aria-hidden="true"
                    >
                        <BrandConfigProvider config={config}>
                            <LayoutSlotsProvider>
                                <ConfigurableLayout config={layout}>
                                    <SamplePage brandName={config.brandName} tagline={config.tagline} />
                                </ConfigurableLayout>
                            </LayoutSlotsProvider>
                        </BrandConfigProvider>
                    </div>
                ) : (
                    <p className="p-6 text-sm text-muted-foreground">Add a brand kit to see the site.</p>
                )}
            </div>
        </div>
    );
}

/** A page with the things a brand kit changes: headings, body text, buttons, cards, a quote */
function SamplePage({ brandName, tagline }: { brandName: string; tagline?: string }) {
    return (
        <div className="space-y-8 py-4">
            <section className="max-w-2xl space-y-4">
                <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Welcome</p>
                <h1
                    className="text-4xl font-bold leading-tight tracking-tight"
                    style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--typography-heading-weight, 700)' }}
                >
                    {brandName}
                </h1>
                <p className="text-lg text-muted-foreground" style={{ fontFamily: 'var(--font-body)' }}>
                    {tagline || 'A short line about what this site is for, set in the body face.'}
                </p>
                <div className="flex flex-wrap gap-3">
                    <Button>Get started</Button>
                    <Button variant="outline">Read the blog</Button>
                </div>
            </section>
            <section className="grid gap-4 md:grid-cols-3">
                {['Fast by default', 'Made to be read', 'Yours to brand'].map((title) => (
                    <Card key={title}>
                        <CardContent className="space-y-2 p-5">
                            <h2 className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                                {title}
                            </h2>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                Cards take the radius, border and shadow of the kit, and links take its primary color.
                            </p>
                            <a href="#" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                                Learn more
                            </a>
                        </CardContent>
                    </Card>
                ))}
            </section>
            <blockquote
                className="max-w-2xl text-2xl font-light leading-snug text-foreground"
                style={{ fontFamily: 'var(--font-handwriting, var(--font-heading))' }}
            >
                Good design is as little design as possible.
            </blockquote>
        </div>
    );
}
