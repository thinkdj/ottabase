// ---------------------------------------------------------------------------
// Brand Engine – ThemeVariant OttaORM Model
// Color/token overlays for seasonal/campaign themes
// ---------------------------------------------------------------------------

import { BaseModel, type PackageType } from '@ottabase/ottaorm';
import { themeVariantsTable } from './schema';
import type { DesignTokens } from '../tokens';
import { deepMerge } from '../resolver';

export class ThemeVariant extends BaseModel {
    static entity = 'theme_variants';
    static table = themeVariantsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/brand-engine';
    static packageType: PackageType = 'package' as PackageType;

    static casts = {
        activeFrom: 'date' as const,
        activeUntil: 'date' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    /**
     * Parse tokensJson to Partial<DesignTokens>
     */
    getTokens(): Partial<DesignTokens> {
        const raw = this.get('tokensJson');
        if (!raw || typeof raw !== 'string') return {};
        try {
            return JSON.parse(raw) as Partial<DesignTokens>;
        } catch {
            return {};
        }
    }

    /**
     * Merge this variant's tokens over base tokens (deep merge)
     */
    mergeTokens(baseTokens: Partial<DesignTokens>): Partial<DesignTokens> {
        const variantTokens = this.getTokens();
        return deepMerge(
            baseTokens as Record<string, unknown>,
            variantTokens as Record<string, unknown>,
        ) as unknown as Partial<DesignTokens>;
    }

    /**
     * Find active variant by date (optional feature)
     * Returns variant where now is within [activeFrom, activeUntil]
     */
    static async findActiveForDate(
        organizationId: string | null,
        appId: string | null,
        now = Date.now(),
    ): Promise<ThemeVariant | null> {
        const variants = (await this.where({
            organizationId: organizationId ?? null,
            appId: appId ?? null,
        })) as ThemeVariant[];

        for (const v of variants) {
            const from = v.get('activeFrom') as number | null;
            const until = v.get('activeUntil') as number | null;
            if (from != null && now < from) continue;
            if (until != null && now > until) continue;
            return v;
        }
        return null;
    }
}
