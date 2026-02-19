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
} from '../defaults';
import type { ResolvedBrandTheme } from '../resolver';
import { deepMerge } from '../resolver';
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

/** Build ResolvedBrandTheme from BrandKit + mode (simplified - no resolution needed) */
export async function brandKitToTheme(kit: BrandKit, mode: string = 'light'): Promise<ResolvedBrandTheme> {
    // Handle inheritance if parent exists
    const hasParent = !!(kit.get('parentBrandKitId') as string | null);
    const tenantTheme = hasParent ? await resolveInheritanceChain(kit) : kit.toBrandTheme();

    const tokens = tenantTheme.tokens;

    // Get mode-specific colors from tokensJson (now contains full expanded theme)
    const defaultPalette = mode === 'dark' ? DEFAULT_COLORS_DARK : DEFAULT_COLORS_LIGHT;
    const rawPalette = tokens.color?.[mode] ?? tokens.color?.light ?? defaultPalette;
    const colors = { ...defaultPalette, ...rawPalette } as TokenColors;

    // Extract other design tokens with defaults
    const typography = tokens.typography;
    const spacing = tokens.spacing ?? DEFAULT_SPACING;
    const radius = tokens.radius ?? '0.5rem';
    const shadows = { ...DEFAULT_SHADOWS, ...(tokens.shadow ?? {}) };
    const motion = { ...DEFAULT_MOTION, ...(tokens.motion ?? {}) };
    const cursors = tenantTheme.cursors ?? DEFAULT_CURSORS;
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
