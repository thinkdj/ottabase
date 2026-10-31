// ---------------------------------------------------------------------------
// Brand Engine – Shared route helpers for worker (v2: per-app scoping)
// ---------------------------------------------------------------------------

import type { BrandApiEnv } from '@ottabase/brand-engine/handlers';
import type { BrandAssetClient } from '@ottabase/brand-engine/persistence';
import { FilesError } from '@ottabase/ottaupload/server';
import { fileIdFromKey } from '@ottabase/utils/media';
import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { files } from '../../ottabase/files';

export type BrandEnv = BrandApiEnv;

export function brandEnv(env: CloudflareEnv): BrandEnv {
    return {
        // Cloudflare publishes separate ambient and importable declarations.
        // Adapt the identical runtime bindings once at the package boundary.
        OBCF_D1: env.OBCF_D1 as BrandApiEnv['OBCF_D1'],
        OBCF_KV: env.OBCF_KV as BrandApiEnv['OBCF_KV'],
        // Logo keys live in the public files bucket; the base is absolute, so a logo URL works in
        // mail and social cards too.
        R2_PUBLIC_URL: files.publicBase(env),
    };
}

/**
 * Brand logos through the files service: purpose `brand-asset` (public, SVG allowed under the
 * sandbox CSP). Brand kits are app-global, so their files belong to the app: no organization
 * and NO user. Owned by the uploading admin, they would go with that admin's account erasure
 * (`files.removeOwned`) and leave the live kit pointing at nothing. The uploader is recorded in
 * the file's metadata (and the brand audit log). Only called behind `requireBrandEditAccess`.
 */
export function brandAssets(env: CloudflareEnv, uploaderId: string | null): BrandAssetClient {
    return {
        async upload(file, type) {
            try {
                const owner = { appId: getAppId(env), userId: null, organizationId: null };
                const metadata = { uploadedBy: uploaderId, logoType: type };
                return (await files.put(env, { purpose: 'brand-asset', owner, file, metadata })).storageKey;
            } catch (error) {
                if (error instanceof FilesError)
                    return errorResponse(error.message, error.status, { code: error.code });
                throw error;
            }
        },
        async remove(key) {
            const id = fileIdFromKey(key);
            if (!id) return;
            await files.remove(env, id).catch((error) => {
                console.warn(JSON.stringify({ event: 'brand_asset_remove_failed', error: redactErrorForLog(error) }));
            });
        },
        url: (key) => files.url(env, key),
    };
}

/** Brand rows are scoped by the server-configured app, never by browser input. */
export function getAppId(env: CloudflareEnv): string {
    return getOttabaseConfig(env).appId;
}
