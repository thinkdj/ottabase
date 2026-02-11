// ---------------------------------------------------------------------------
// Brand Engine – Layout path resolution (pure functions, no React)
// ---------------------------------------------------------------------------

/**
 * Convert path pattern to regex.
 * * = one segment ([^/]+), ** = zero-or-more segments (.*)
 */
export function pathPatternToRegex(pattern: string): RegExp {
    const escaped = pattern
        .replace(/\*\*/g, '<<GLOB>>')
        .replace(/\*/g, '[^/]+')
        .replace(/<<GLOB>>/g, '.*');
    return new RegExp(`^${escaped}$`);
}

/**
 * Resolve layout template ID for a given path from route mappings.
 * Higher priority number = checked first.
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
