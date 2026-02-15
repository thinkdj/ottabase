// ---------------------------------------------------------------------------
// Brand Engine – Convert BrandKit to theme/identity for ResolvedBrandConfig
// Supports parent kit inheritance: child tokens are deep-merged on top of parent's.
// ---------------------------------------------------------------------------

import { BrandKit } from './BrandKit.model';
import type { DesignTokens } from '../tokens';
import type { BrandTheme } from '../theme';
import type { ResolvedBrandTheme } from '../resolver';
import { DEFAULT_BRAND_THEME } from '../defaults';
import { getThemeByName } from '../registry';
import { deepMerge, resolveTheme } from '../resolver';

/**
 * When a preset is selected, it fully overrides color palette (buttons, sidebar, etc.).
 * Strips color from tenantOverrides so preset colors win; tokensJson color is ignored.
 * Other tokens (typography, spacing, radius, etc.) can still override the preset.
 */
function tenantOverridesForPreset(tenantTheme: BrandTheme, presetId: string | null): Partial<BrandTheme> {
    if (!presetId || !tenantTheme?.tokens) return tenantTheme;
    const { color: _color, ...tokensWithoutColor } = tenantTheme.tokens;
    return {
        ...tenantTheme,
        tokens: tokensWithoutColor as DesignTokens,
    };
}

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
        if (visited.has(parentId)) break; // circular ref guard
        visited.add(parentId);

        const parent = (await BrandKit.find(parentId)) as BrandKit | null;
        if (!parent) break;
        chain.unshift(parent); // prepend parent so chain is root → ... → child
        current = parent;
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

/** Build ResolvedBrandTheme from BrandKit + mode, with inheritance support */
export async function brandKitToTheme(kit: BrandKit, mode: 'light' | 'dark' = 'light'): Promise<ResolvedBrandTheme> {
    const hasParent = !!(kit.get('parentBrandKitId') as string | null);
    const tenantTheme = hasParent ? await resolveInheritanceChain(kit) : kit.toBrandTheme();
    const presetId = (kit.get('themePresetId') as string) || null;
    const baseTheme: BrandTheme =
        presetId && getThemeByName(presetId) ? getThemeByName(presetId)! : DEFAULT_BRAND_THEME;
    const overrides = tenantOverridesForPreset(tenantTheme, presetId);
    return resolveTheme({
        base: baseTheme,
        tenantOverrides: overrides,
        mode,
    });
}

/** Extract logo URLs from BrandKit */
export function brandKitLogos(kit: BrandKit, r2PublicUrl: string) {
    return kit.getLogoUrls(r2PublicUrl);
}
