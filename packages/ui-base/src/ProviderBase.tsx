'use client';

import React, { ReactNode, useEffect } from 'react';

/**
 * Base UI Provider
 *
 * Provides base styles and font configuration for UI frameworks.
 * This provider handles FOUC prevention and font family configuration.
 *
 * Place this at the root of your component tree to ensure
 * base styles (reset, animations, utilities) and fonts are configured properly.
 */

// Import base styles
import '../styles/index.css';

export type ProviderUIBaseFontFamilies = {
    primary?: string;
    heading?: string;
    monospace?: string;
};

/** Static fallback stacks, used when the Brand Engine vars are not defined. */
const FONT_STACKS = {
    body: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif",
    heading: "Work Sans, 'Palanquin Dark', 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif",
    monospace:
        "JetBrains Mono, 'Fira Code', 'Reddit Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace",
} as const;

/** Defaults defer to the Brand Engine font vars, falling back to the static stacks. */
const DEFAULT_FONT_FAMILIES: Required<ProviderUIBaseFontFamilies> = {
    primary: `var(--font-body, ${FONT_STACKS.body})`,
    heading: `var(--font-heading, ${FONT_STACKS.heading})`,
    monospace: `var(--font-mono, ${FONT_STACKS.monospace})`,
};

interface ProviderUIBaseProps {
    children: ReactNode;
    preventFOUC?: boolean;
    preventFOUCInsideIframe?: boolean;
    fontFamilies?: ProviderUIBaseFontFamilies;
    /** When true, do NOT set --font-heading/--font-body on wrapper (Brand Engine sets them on :root) */
    fontVarsFromRoot?: boolean;
}

export const ProviderUIBase = ({
    children,
    preventFOUC = false,
    preventFOUCInsideIframe = false,
    fontFamilies,
    fontVarsFromRoot = false,
}: ProviderUIBaseProps): React.JSX.Element => {
    const mergedFontFamilies = {
        ...DEFAULT_FONT_FAMILIES,
        ...fontFamilies,
    } satisfies Required<ProviderUIBaseFontFamilies>;

    const [isInsideIFRAME, setIsInsideIFRAME] = React.useState(false);

    useEffect(() => {
        setIsInsideIFRAME(window.self !== window.top);
    }, []);

    const shouldPreventFOUC = preventFOUC && (!isInsideIFRAME || preventFOUCInsideIframe);

    const baseStyle = shouldPreventFOUC
        ? { visibility: 'hidden' as const }
        : ({
              fontFamily: mergedFontFamilies.primary,
              ...(fontVarsFromRoot
                  ? { '--font-monospace': mergedFontFamilies.monospace }
                  : {
                        // Use the caller-provided heading or the raw stack: assigning the
                        // default `var(--font-heading, …)` to --font-heading itself would
                        // create a self-referential cycle and invalidate the property.
                        '--font-heading': fontFamilies?.heading ?? FONT_STACKS.heading,
                        '--font-monospace': mergedFontFamilies.monospace,
                    }),
          } as React.CSSProperties);

    return (
        <div style={baseStyle} suppressHydrationWarning>
            {children}
        </div>
    );
};

export default ProviderUIBase;
