'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getTheme, themeStyles, type ColorScheme } from '../themes';
import { LandingView, type LandingViewProps } from './view';

export type LandingPreviewProps = LandingViewProps & {
    /** The desktop width the page is laid out at before being scaled to fit. */
    width?: number;
    className?: string;
    /** Preview in light or dark; defaults to the theme's own scheme. */
    scheme?: ColorScheme;
};

/**
 * A non-interactive, scaled-to-fit preview of a page in its theme — with the theme's
 * tokens scoped to the preview, so it can sit inside any app without restyling it.
 */
export function LandingPreview({ width = 1280, className, scheme, ...view }: LandingPreviewProps) {
    const outer = useRef<HTMLDivElement>(null);
    const inner = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [height, setHeight] = useState(0);
    const { css, fonts } = useMemo(() => themeStyles(view.site.theme, '[data-landing-preview]'), [view.site.theme]);

    useLayoutEffect(() => {
        if (!outer.current || !inner.current) return;
        const measure = () => {
            setScale(Math.min(1, (outer.current?.clientWidth ?? width) / width));
            setHeight(inner.current?.offsetHeight ?? 0);
        };
        const observer = new ResizeObserver(measure);
        observer.observe(outer.current);
        observer.observe(inner.current);
        measure();
        return () => observer.disconnect();
    }, [width]);

    return (
        <div ref={outer} className={className} style={{ overflow: 'hidden', height: height * scale || undefined }}>
            <style>{css}</style>
            {fonts.map((href) => (
                <link key={href} rel="stylesheet" href={href} />
            ))}
            <div
                ref={inner}
                data-landing-preview=""
                data-scheme={scheme ?? getTheme(view.site.theme).scheme}
                inert
                style={{ width, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            >
                <LandingView {...view} />
            </div>
        </div>
    );
}
