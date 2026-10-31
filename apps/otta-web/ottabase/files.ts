// ============================================================
// The app's files service — one instance, every writer of user files
// ============================================================
// Avatars, the media library, brand assets, landing share images and any package's own
// purpose (Pro og-studio, a helpdesk's attachments) store through THIS object, so the
// pipeline (sniff, allow-list, metadata strip, buckets, variants, quota) has one place.
// Purposes come from the manifests' `files` fields (`packages.files()`); the core ones are
// declared in `packages/core.ts`.
//
// A package never imports this module: like the event bus, it takes the service as an
// option (`files?: Files<Env>` from `@ottabase/ottaupload/server`) and the composition in
// `ottabase/packages/<pkg>.ts` passes `files`.
// ============================================================

import { mediaFileStore } from '@ottabase/ottaorm';
import { createFiles, quotaBytes, type FilesBucket } from '@ottabase/ottaupload/server';
import { getOttabaseConfig } from './config.loader';
import { packages } from './registry';

// The env's R2Bucket and ottaupload's slice come from different workers-types copies.
const bucket = (binding: R2Bucket | undefined) => (binding ?? null) as FilesBucket | null;

/**
 * Purge a quarantined file's public URLs from Cloudflare's cache: public files are cached as
 * immutable for a year, so moving the object alone leaves it at the edge. Needs the files zone
 * (`CLOUDFLARE_FILES_ZONE_ID`) and a token with Cache Purge on it (`CLOUDFLARE_PURGE_API_TOKEN`);
 * false without them or when Cloudflare refuses, and the admin is told to purge by hand.
 */
export async function purgeFromCache(env: CloudflareEnv, urls: string[]): Promise<boolean> {
    const zone = env.CLOUDFLARE_FILES_ZONE_ID;
    const token = env.CLOUDFLARE_PURGE_API_TOKEN;
    if (!zone || !token || urls.length === 0) return false;
    try {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone)}/purge_cache`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: urls }),
            },
        );
        return response.ok;
    } catch {
        return false;
    }
}

export const files = createFiles<CloudflareEnv>({
    appId: (env) => getOttabaseConfig(env).appId,
    purposes: () => packages.files(),
    store: mediaFileStore,
    buckets: (env) => ({ public: bucket(env.OBCF_R2), private: bucket(env.OBCF_R2_PRIVATE) }),
    images: (env) => env.OBCF_IMAGES,
    publicUrl: (env) => env.R2_PUBLIC_URL,
    // The public origin the framework already uses for links in mail: public URLs come out absolute.
    origin: (env) => env.AUTH_URL,
    signingSecret: (env) => env.FILES_SIGNING_SECRET,
    // One limit for everyone. Plan-based limits replace this with a lookup of the owner's plan.
    quota: (env) => quotaBytes(env.FILES_QUOTA_MB),
    purge: purgeFromCache,
});
