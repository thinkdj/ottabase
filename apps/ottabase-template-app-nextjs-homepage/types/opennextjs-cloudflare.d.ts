/**
 * Type declarations for @opennextjs/cloudflare
 * This ensures that getCloudflareContext returns our custom CloudflareEnv type
 */

import type { CloudflareEnv } from './cloudflare';

declare module '@opennextjs/cloudflare' {
    export function getCloudflareContext(): Promise<{
        env: CloudflareEnv;
        cf: any; // Use any to avoid type conflicts between Cloudflare and standard types
        ctx: any; // Use any to avoid type conflicts
    }>;

    export function initOpenNextCloudflareForDev(): void;
}
