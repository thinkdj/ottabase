// ---------------------------------------------------------------------------
// Brand Engine – API handlers for brand config
// GET /api/brand – full config (route mappings, layouts, all brand kits). Client resolves path locally.
// ---------------------------------------------------------------------------

import { resolveFullBrandConfig } from '../persistence/resolveBrandConfig';
import { errorResponse } from '@ottabase/utils/http-errors';
import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { FullBrandConfig } from '../persistence/resolveBrandConfig';

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
    if (kits.length !== 1) return config;
    const kit = kits[0];
    return {
        kit,
        routes: config.routeMappings.map(
            (m) => [m.pathPattern, m.layoutTemplateId, m.priority] as [string, string, number],
        ),
        layoutTemplatesMap: config.layoutTemplatesMap,
        brandKitsMap: config.brandKitsMap,
        mode: config.mode,
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
    const mode = modeParam === 'dark' ? 'dark' : 'light';

    const config = await resolveFullBrandConfig(env, {
        organizationId: organizationId ?? url.searchParams.get('organizationId') ?? null,
        appId: appId ?? url.searchParams.get('appId') ?? null,
        mode,
    });

    if (!config) return errorResponse('Brand config not found', 404);
    return jsonResponse(toCompactResponse(config), 200);
}

// Re-export layout handlers
export { handleGetLayouts, handlePutLayout, handleGetMappings, handlePutMappings } from './layout-api';

// Re-export Brand Kit handlers
export {
    handleGetBrandKits,
    handleGetBrandKit,
    handleCreateBrandKit,
    handleUpdateBrandKit,
    handleDeleteBrandKit,
    handleCloneBrandKit,
    handleUploadBrandKitLogo,
} from './brand-kit-api';
