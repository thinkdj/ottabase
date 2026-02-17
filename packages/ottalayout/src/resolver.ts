// ---------------------------------------------------------------------------
// @ottabase/ottalayout – Layout path resolution (pure functions, no React)
//
// Resolves which layout preset to use for a given URL path. Path patterns
// support * (single segment) and ** (zero-or-more segments) wildcards.
// ---------------------------------------------------------------------------

/** Regex metacharacters to escape for literal matching (except * and ** which are wildcards) */
const REGEX_SPECIAL = /[.+?^${}()|[\]\\]/g;

/**
 * Convert a path pattern to a RegExp.
 *
 * - `*` matches one path segment (`[^/]+`)
 * - `**` matches zero-or-more segments (`.*`)
 * - All other regex metacharacters are escaped for literal matching
 * - `/blog/**` also matches `/blog` (exact base path)
 */
export function pathPatternToRegex(pattern: string): RegExp {
    let escaped = pattern
        .replace(/\*\*/g, '<<GLOB>>')
        .replace(/\*/g, '<<STAR>>')
        .replace(REGEX_SPECIAL, '\\$&')
        .replace(/<<GLOB>>/g, '.*')
        .replace(/<<STAR>>/g, '[^/]+');

    // /blog/** should match /blog and /blog/anything – make trailing /.* optional
    if (pattern.endsWith('/**')) {
        escaped = escaped.replace(/\/\.\*$/, '(\/.*)?');
    }

    return new RegExp(`^${escaped}$`);
}

/**
 * Resolve layout template ID for a given path from route mappings.
 * Higher `priority` number = checked first.
 */
export function resolveLayoutForPath(
    pathname: string,
    routeMappings: Array<{ pathPattern: string; layoutTemplateId: string; priority?: number }>,
): string | null {
    const sorted = [...routeMappings].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const m of sorted) {
        const re = pathPatternToRegex(m.pathPattern);
        if (re.test(pathname)) return m.layoutTemplateId;
    }
    return null;
}

/** Result of a full route match (layout + brand kit + token overrides) */
export interface RouteMatchResult {
    layoutTemplateId: string;
    brandKitId: string;
    /** Per-route token overrides JSON (if defined on the matched route mapping) */
    tokenOverridesJson?: string | null;
}

/**
 * Resolve layout + brand kit for a given path. Returns matched row or null.
 */
export function resolveRouteForPath(
    pathname: string,
    routeMappings: Array<{
        pathPattern: string;
        layoutTemplateId: string;
        brandKitId: string;
        priority?: number;
        tokenOverridesJson?: string | null;
    }>,
): RouteMatchResult | null {
    const sorted = [...routeMappings].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const m of sorted) {
        const re = pathPatternToRegex(m.pathPattern);
        if (re.test(pathname)) {
            return {
                layoutTemplateId: m.layoutTemplateId,
                brandKitId: m.brandKitId,
                tokenOverridesJson: m.tokenOverridesJson,
            };
        }
    }
    return null;
}
