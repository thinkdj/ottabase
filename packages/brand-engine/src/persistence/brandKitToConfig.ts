// ---------------------------------------------------------------------------
// Brand Engine – Convert BrandKit to theme/identity for ResolvedBrandConfig
// Supports parent kit inheritance: child tokens are deep-merged on top of parent's.
// Per-category resolution delegates to resolve-core.ts (shared with resolver.ts
// and previewTheme.ts).
// ---------------------------------------------------------------------------

import { DEFAULT_LAYOUT } from '@ottabase/ottalayout';
import { DEFAULT_CURSORS } from '../defaults';
import {
    darkSplitCategories,
    pickMode,
    resolveCursors,
    resolveTokenSet,
    resolveBorder,
    resolveFocus,
    resolveInteraction,
    resolveLinks,
    resolveMotion,
    resolveNative,
    resolvePalette,
    resolveRadius,
    resolveScrollbar,
    resolveSelection,
    resolveShadows,
    resolveSpacing,
    resolveSurface,
    resolveTextStyles,
    resolveTypeScale,
    resolveTypography,
    resolveZIndex,
} from '../resolve-core';
import { resolveColors, resolveAliases } from '../resolve-core';
import type { ResolvedBrandTheme } from '../resolver';
import { deepMerge } from '../resolver';
import type { BrandTheme } from '../theme';
import type { DesignTokens } from '../tokens';
import { BrandKit } from './BrandKit.model';

/** Max depth for parent chain traversal (prevents infinite loops from circular refs) */
const MAX_INHERITANCE_DEPTH = 5;

/**
 * Walk the parent chain and collect BrandTheme overrides from root → child.
 * Returns the merged tenant theme that represents the full inheritance chain.
 */
export async function resolveInheritanceChain(kit: BrandKit): Promise<BrandTheme> {
    const chain: BrandKit[] = [kit];
    const visited = new Set<string>([kit.get('id') as string]);

    let current = kit;
    for (let depth = 0; depth < MAX_INHERITANCE_DEPTH; depth++) {
        const parentId = current.get('parentBrandKitId') as string | null;
        if (!parentId) break;
        if (visited.has(parentId)) {
            console.warn(
                `[Brand Engine] Circular inheritance detected: kit "${kit.get('name')}" (${kit.get('id')}) → parent "${parentId}". Breaking cycle.`,
            );
            break;
        }
        visited.add(parentId);

        const parent = (await BrandKit.find(parentId)) as BrandKit | null;
        if (!parent) {
            console.warn(
                `[Brand Engine] Parent kit "${parentId}" not found for kit "${current.get('name')}" (${current.get('id')}). Stopping inheritance chain.`,
            );
            break;
        }
        chain.unshift(parent); // prepend parent so chain is root → ... → child
        current = parent;
    }

    if (chain.length > 1 && current.get('parentBrandKitId')) {
        console.warn(
            `[Brand Engine] Max inheritance depth (${MAX_INHERITANCE_DEPTH}) reached for kit "${kit.get('name')}" (${kit.get('id')}). Chain may be incomplete.`,
        );
    }

    // Merge from root → child: each layer's tokensJson overrides the previous
    let merged: Partial<BrandTheme> = {};
    for (const link of chain) {
        const linkTheme = link.toBrandTheme();
        if (linkTheme.tokens) {
            merged = deepMerge(
                merged as Record<string, unknown>,
                linkTheme as unknown as Record<string, unknown>,
            ) as unknown as Partial<BrandTheme>;
        }
    }

    return merged as BrandTheme;
}

/**
 * Build ResolvedBrandTheme from BrandKit + mode.
 *
 * Light mode:  returns a FULL ResolvedBrandTheme (all tokens with defaults filled in).
 * Dark mode:   returns a DELTA (Partial<ResolvedBrandTheme>) containing only the tokens
 *              that have an explicit `{ light, dark }` ModeValue split in the source data.
 *              Colors and shadows are ALWAYS included in the dark delta (their dark
 *              defaults differ from light). fontFaces/effects/scopes are never
 *              mode-split — they ride the light theme and survive the deepMerge.
 *              Consumers (resolveConfigFromFull server-side, resolveConfigForPath
 *              client-side) deep-merge lightTheme + darkDelta at request time.
 */
export async function brandKitToTheme(kit: BrandKit, mode: 'light'): Promise<ResolvedBrandTheme>;
export async function brandKitToTheme(kit: BrandKit, mode: 'dark'): Promise<Partial<ResolvedBrandTheme>>;
export async function brandKitToTheme(
    kit: BrandKit,
    mode: string,
): Promise<ResolvedBrandTheme | Partial<ResolvedBrandTheme>>;
export async function brandKitToTheme(
    kit: BrandKit,
    mode: string = 'light',
): Promise<ResolvedBrandTheme | Partial<ResolvedBrandTheme>> {
    // Handle inheritance if parent exists
    const hasParent = !!(kit.get('parentBrandKitId') as string | null);
    const tenantTheme = hasParent ? await resolveInheritanceChain(kit) : kit.toBrandTheme();

    const tokens = tenantTheme.tokens as Partial<DesignTokens> | undefined;

    // -----------------------------------------------------------------------
    // DARK MODE → delta only (tokens explicitly split with { light, dark })
    // Consumer will deepMerge(lightTheme, darkDelta) at request time.
    // -----------------------------------------------------------------------
    if (mode !== 'light') {
        const split = darkSplitCategories(tokens);
        const delta: Partial<ResolvedBrandTheme> = {};

        // Colors + shadows: ALWAYS in the delta — dark defaults differ from light
        const colors = resolveAliases(resolveColors(tokens, mode), tokens?.aliases);
        delta.colors = colors;
        delta.shadows = resolveShadows(tokens, mode);

        // Sparse + defaulted categories: included only when explicitly dark-split
        if (split.has('palette')) delta.palette = resolvePalette(tokens, mode, colors);
        if (split.has('typography')) delta.typography = resolveTypography(tokens, mode);
        if (split.has('typeScale')) delta.typeScale = resolveTypeScale(tokens, mode);
        if (split.has('spacing')) delta.spacing = resolveSpacing(tokens, mode);
        if (split.has('radius')) {
            const { radius, radiusScale } = resolveRadius(tokens, mode);
            delta.radius = radius;
            if (radiusScale) delta.radiusScale = radiusScale;
        }
        if (split.has('border')) delta.border = resolveBorder(tokens, mode);
        if (split.has('motion')) delta.motion = resolveMotion(tokens, mode);
        if (split.has('focus')) delta.focus = resolveFocus(tokens, mode);
        if (split.has('interaction')) delta.interaction = resolveInteraction(tokens, mode);
        if (split.has('links')) delta.links = resolveLinks(tokens, mode);
        if (split.has('selection')) delta.selection = resolveSelection(tokens, mode);
        if (split.has('scrollbar')) delta.scrollbar = resolveScrollbar(tokens, mode);
        if (split.has('native')) delta.native = resolveNative(tokens, mode);
        if (split.has('zIndex')) delta.zIndex = resolveZIndex(tokens, mode);
        if (split.has('textStyles')) delta.textStyles = resolveTextStyles(tokens, mode);
        if (split.has('surface')) delta.surface = resolveSurface(tokens, mode);

        // Cursors live at the BrandTheme root (not in DesignTokens)
        const rawCursors = tenantTheme.cursors;
        if (
            tokens?.disabled?.cursors !== true &&
            typeof rawCursors === 'object' &&
            rawCursors !== null &&
            'dark' in rawCursors
        ) {
            delta.cursors = pickMode(rawCursors, mode) ?? DEFAULT_CURSORS;
        }

        // layout is never mode-split; omit from dark delta — inherited from light via deepMerge

        return delta;
    }

    // -----------------------------------------------------------------------
    // LIGHT MODE (or any non-dark mode) → full resolved theme with defaults
    // -----------------------------------------------------------------------
    const tokenSet = resolveTokenSet(tokens, mode);
    const cursors = resolveCursors(tokens, tenantTheme.cursors, mode);
    const layout = { ...DEFAULT_LAYOUT, ...(tenantTheme.layout ?? {}) };

    return {
        name: tenantTheme.name,
        ...tokenSet,
        cursors,
        layout,
    };
}

/** Extract logo URLs from BrandKit */
export function brandKitLogos(kit: BrandKit, r2PublicUrl: string) {
    return kit.getLogoUrls(r2PublicUrl);
}
