// ---------------------------------------------------------------------------
// Brand Engine – API handlers for brand config
// GET /api/brand – full config (route mappings, layouts, all brand kits). Client resolves path locally.
// ---------------------------------------------------------------------------

import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { FullBrandConfig } from '../persistence/resolveBrandConfig';
import { resolveFullBrandConfig } from '../persistence/resolveBrandConfig';

export interface BrandApiEnv {
    OBCF_D1: D1Database;
    OBCF_KV: KVNamespace;
    OBCF_R2: R2Bucket;
    R2_PUBLIC_URL?: string;
}

/** Compact response when single kit – avoids repeating brandKitId on every route */
export type CompactBrandConfig = Omit<FullBrandConfig, 'routeMappings'> & {
    kit: string;
    routes: [string, string, number][]; // [path, layout, priority]
};

function toCompactResponse(config: FullBrandConfig): CompactBrandConfig | FullBrandConfig {
    const kits = [...new Set(config.routeMappings.map((m) => m.brandKitId))];
    // Cannot compact when multiple kits or when any route has token overrides
    const hasTokenOverrides = config.routeMappings.some((m) => m.tokenOverridesJson);
    if (kits.length !== 1 || hasTokenOverrides) return config;
    const kit = kits[0];
    return {
        kit,
        routes: config.routeMappings.map(
            (m) => [m.pathPattern, m.layoutTemplateId, m.priority] as [string, string, number],
        ),
        layoutTemplatesMap: config.layoutTemplatesMap,
        brandKitsMap: config.brandKitsMap,
        mode: config.mode,
        r2PublicUrl: config.r2PublicUrl,
    };
}

/**
 * GET /api/brand – Return full resolution data in one response.
 * When single brand kit: compact format (kit + routes). Client expands and matches path locally.
 */
export async function handleGetBrand(
    request: Request,
    env: BrandApiEnv,
    organizationId?: string | null,
    appId?: string | null,
): Promise<Response> {
    const url = new URL(request.url);
    const modeParam = url.searchParams.get('mode');
    const mode = modeParam || 'light';

    const config = await resolveFullBrandConfig(env, {
        organizationId: organizationId ?? url.searchParams.get('organizationId') ?? null,
        appId: appId ?? url.searchParams.get('appId') ?? null,
        mode,
    });

    if (!config) return errorResponse('Brand config not found', 404);
    return jsonResponse(toCompactResponse(config), 200);
}

// Re-export layout handlers
export { handleGetLayouts, handleGetMappings, handlePutLayout, handlePutMappings } from './layout-api';

// Re-export Brand Kit handlers
export {
    handleCloneBrandKit,
    handleCreateBrandKit,
    handleDeleteBrandKit,
    handleGetBrandKit,
    handleGetBrandKits,
    handleUpdateBrandKit,
    handleUploadBrandKitLogo,
} from './brand-kit-api';
