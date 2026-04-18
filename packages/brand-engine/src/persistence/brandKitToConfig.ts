// ---------------------------------------------------------------------------
// Brand Engine – Convert BrandKit to theme/identity for ResolvedBrandConfig
// Supports parent kit inheritance: child tokens are deep-merged on top of parent's.
// ---------------------------------------------------------------------------

import { DEFAULT_LAYOUT } from '@ottabase/ottalayout';
import {
    DEFAULT_COLORS_DARK,
    DEFAULT_COLORS_LIGHT,
    DEFAULT_CURSORS,
    DEFAULT_MOTION,
    DEFAULT_SHADOWS,
    DEFAULT_SPACING,
    DEFAULT_TYPOGRAPHY,
} from '../defaults';
import type { ResolvedBrandTheme } from '../resolver';
import { deepMerge, resolveModeValue } from '../resolver';
import type { BrandTheme } from '../theme';
import type { TokenColors } from '../tokens';
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
 * Returns true when a raw token value has an explicit dark-mode split
 * (i.e. `{ dark: ... }` key present). Used to decide what goes in the dark delta.
 */
function hasDarkSplit(val: unknown): boolean {
    return typeof val === 'object' && val !== null && 'dark' in (val as object);
}

/**
 * Build ResolvedBrandTheme from BrandKit + mode.
 *
 * Light mode:  returns a FULL ResolvedBrandTheme (all tokens with defaults filled in).
 * Dark mode:   returns a DELTA (Partial<ResolvedBrandTheme>) containing only the tokens
 *              that have an explicit `{ light, dark }` ModeValue split in the source data.
 *              Colors are ALWAYS included in the dark delta (dark palette is always different).
 *              The consumer (resolveBrandConfig) deep-merges lightTheme + darkDelta at request time.
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

    const tokens = tenantTheme.tokens;

    // Helpers for resolveModeValue isBase predicates
    const isStringMap = (v: unknown): boolean =>
        typeof v === 'object' && v !== null && Object.values(v as object).every((x) => typeof x === 'string');
    const isTypoBase = (v: unknown): boolean =>
        typeof v === 'object' && v !== null && ('heading' in (v as object) || 'body' in (v as object));

    // Colors: always resolve for both modes (dark palette always differs from light)
    const defaultPalette = mode === 'dark' ? DEFAULT_COLORS_DARK : DEFAULT_COLORS_LIGHT;
    const rawPalette = tokens.color?.[mode] ?? tokens.color?.light ?? defaultPalette;
    const colors = { ...defaultPalette, ...rawPalette } as TokenColors;

    // -----------------------------------------------------------------------
    // DARK MODE → delta only (tokens explicitly split with { light, dark })
    // Consumer will deepMerge(lightTheme, darkDelta) at request time.
    // -----------------------------------------------------------------------
    if (mode !== 'light') {
        const delta: Partial<ResolvedBrandTheme> = { colors };

        if (hasDarkSplit(tokens?.typography)) {
            const rawTypo = resolveModeValue(tokens.typography, mode, isTypoBase);
            delta.typography = {
                heading: { ...DEFAULT_TYPOGRAPHY.heading, ...rawTypo?.heading },
                body: { ...DEFAULT_TYPOGRAPHY.body, ...rawTypo?.body },
                handwriting: { ...DEFAULT_TYPOGRAPHY.handwriting, ...rawTypo?.handwriting },
            };
        }

        if (hasDarkSplit(tokens?.spacing)) {
            const rawSpacing = resolveModeValue(tokens.spacing, mode, isStringMap);
            delta.spacing = { ...DEFAULT_SPACING, ...(rawSpacing ?? {}) };
        }

        if (hasDarkSplit(tokens?.radius)) {
            delta.radius = resolveModeValue(tokens.radius, mode, (v) => typeof v === 'string') ?? '0.5rem';
        }

        if (hasDarkSplit(tokens?.shadow)) {
            const rawShadows = resolveModeValue(tokens.shadow, mode, isStringMap);
            delta.shadows = { ...DEFAULT_SHADOWS, ...(rawShadows ?? {}) };
        }

        if (hasDarkSplit(tokens?.motion)) {
            const rawMotion = resolveModeValue(tokens.motion, mode, isStringMap);
            delta.motion = { ...DEFAULT_MOTION, ...(rawMotion ?? {}) };
        }

        if (hasDarkSplit(tenantTheme.cursors)) {
            const rawCursors = resolveModeValue(tenantTheme.cursors, mode, isStringMap);
            delta.cursors = rawCursors ?? DEFAULT_CURSORS;
        }

        // layout is never mode-split; omit from dark delta — inherited from light via deepMerge

        return delta;
    }

    // -----------------------------------------------------------------------
    // LIGHT MODE (or any non-dark mode) → full resolved theme with defaults
    // -----------------------------------------------------------------------
    const rawTypo = resolveModeValue(tokens?.typography, mode, isTypoBase);
    const typography = {
        heading: { ...DEFAULT_TYPOGRAPHY.heading, ...rawTypo?.heading },
        body: { ...DEFAULT_TYPOGRAPHY.body, ...rawTypo?.body },
        handwriting: { ...DEFAULT_TYPOGRAPHY.handwriting, ...rawTypo?.handwriting },
    };

    const rawSpacing = resolveModeValue(tokens?.spacing, mode, isStringMap);
    const spacing = { ...DEFAULT_SPACING, ...(rawSpacing ?? {}) };

    const rawRadius = resolveModeValue(tokens?.radius, mode, (v) => typeof v === 'string');
    const radius = rawRadius ?? '0.5rem';

    const rawShadows = resolveModeValue(tokens?.shadow, mode, isStringMap);
    const shadows = { ...DEFAULT_SHADOWS, ...(rawShadows ?? {}) };

    const rawMotion = resolveModeValue(tokens?.motion, mode, isStringMap);
    const motion = { ...DEFAULT_MOTION, ...(rawMotion ?? {}) };

    const rawCursors = resolveModeValue(tenantTheme.cursors, mode, isStringMap);
    const cursors = rawCursors ?? DEFAULT_CURSORS;
    const layout = { ...DEFAULT_LAYOUT, ...(tenantTheme.layout ?? {}) };

    return {
        name: tenantTheme.name,
        colors,
        typography,
        spacing,
        radius,
        shadows,
        motion,
        cursors,
        layout,
    };
}

/** Extract logo URLs from BrandKit */
export function brandKitLogos(kit: BrandKit, r2PublicUrl: string) {
    return kit.getLogoUrls(r2PublicUrl);
}
