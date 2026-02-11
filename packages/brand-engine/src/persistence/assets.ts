// ---------------------------------------------------------------------------
// Brand Engine – R2 asset management for logos
// Upload logos to R2, return public URLs
// ---------------------------------------------------------------------------

import type { R2Bucket } from '@cloudflare/workers-types';

export type LogoType = 'logo' | 'logo-dark' | 'icon' | 'og-image' | 'email-logo';

export interface BrandAssetClient {
    uploadLogo(file: ArrayBuffer, filename: string, type: LogoType): Promise<string>;
    deleteLogo(key: string): Promise<void>;
    getPublicUrl(key: string): string;
}

function getContentType(ext: string): string {
    const types: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        svg: 'image/svg+xml',
        webp: 'image/webp',
        ico: 'image/x-icon',
    };
    return types[ext.toLowerCase()] || 'application/octet-stream';
}

export function createBrandAssets(bucket: R2Bucket, publicUrlBase: string): BrandAssetClient {
    return {
        async uploadLogo(file, filename, type) {
            const ext = filename.split('.').pop() || 'png';
            const key = `brand-assets/${type}/${crypto.randomUUID()}.${ext}`;

            await bucket.put(key, file, {
                httpMetadata: {
                    contentType: getContentType(ext),
                    cacheControl: 'public, max-age=31536000', // 1 year
                },
            });

            return key;
        },

        async deleteLogo(key) {
            await bucket.delete(key);
        },

        getPublicUrl(key) {
            return `${publicUrlBase}/${key}`;
        },
    };
}
