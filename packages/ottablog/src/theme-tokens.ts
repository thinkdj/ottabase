/**
 * Blog theme tokens — the data half of "decoupled contract, integrated
 * experience". A blog theme row can carry sparse CSS custom-property
 * overrides; this module serializes them into a `[data-brand-scope="blog"]`
 * room block so they re-bind the app's semantic brand variables for blog
 * subtrees only. The package never imports brand-engine: CSS variables ARE
 * the contract, and an app without brand-engine simply resolves the same
 * vars from its own stylesheets (or the values act as plain custom props).
 *
 * Sparse by law: no tokens (or none valid) serializes to '' and the blog
 * renders pixel-identical to the unthemed baseline.
 */

export interface BlogThemeTokens {
    /** Light-palette overrides: CSS custom property name → value. */
    light?: Record<string, string>;
    /** Dark-palette overrides, applied under the dark-mode selector. */
    dark?: Record<string, string>;
}

/** CSS custom property name: `--` followed by a safe ident charset. */
const TOKEN_NAME = /^--[a-zA-Z0-9_-]+$/;

/**
 * Values are admin-authored free-form CSS. Reject anything that could break
 * out of a declaration or the style tag: braces, semicolons, comment/escape
 * openers, and `<` (style-tag close). Parens, commas, spaces, percents stay
 * allowed — real values like `color-mix(in oklch, red 40%, blue)` need them.
 */
const TOKEN_VALUE_FORBIDDEN = /[{};<>\\]|\/\*/;

function serializeBlock(selector: string, entries: Record<string, string> | undefined): string {
    if (!entries) return '';
    const declarations: string[] = [];
    for (const [name, value] of Object.entries(entries)) {
        if (!TOKEN_NAME.test(name)) continue;
        if (typeof value !== 'string' || !value.trim() || TOKEN_VALUE_FORBIDDEN.test(value)) continue;
        declarations.push(`${name}: ${value.trim()};`);
    }
    if (declarations.length === 0) return '';
    return `${selector} {\n    ${declarations.join('\n    ')}\n}`;
}

export interface BlogThemeCssOptions {
    /** Room name for the [data-brand-scope] selector. Default 'blog'. */
    scope?: string;
    /** Dark-mode ancestor selector. Default '.dark' (matches next-themes). */
    darkSelector?: string;
}

/**
 * Serialize sparse blog theme tokens to scoped CSS. Returns '' when nothing
 * valid is defined. Output is safe for a <style> tag by construction (names
 * and values are validated), but callers embedding it into HTML should still
 * run their standard CSS sanitizer — defense in depth, same as brand CSS.
 */
export function blogThemeTokensToCss(
    tokens: BlogThemeTokens | null | undefined,
    options?: BlogThemeCssOptions,
): string {
    if (!tokens) return '';
    const scope = options?.scope ?? 'blog';
    if (!/^[a-zA-Z0-9_-]+$/.test(scope)) return '';
    const darkSelector = options?.darkSelector ?? '.dark';
    const roomSelector = `[data-brand-scope="${scope}"]`;

    const blocks = [
        serializeBlock(roomSelector, tokens.light),
        serializeBlock(`${darkSelector} ${roomSelector}`, tokens.dark),
    ].filter(Boolean);

    return blocks.join('\n');
}
