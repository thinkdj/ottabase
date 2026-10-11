// Images uploaded in otta-web's admin (logos, hero shots, social images) are stored as
// /api/upload/file/<key> URLs. Serving that same path from the same R2 bucket makes those
// URLs work here unchanged — and keeps the site's images on its own origin.

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { serveR2Object } from '@ottabase/ottaupload/server';
import { errorResponse } from '@ottabase/utils/http-errors';

type Params = { params: Promise<{ key: string[] }> };

export async function GET(_request: Request, { params }: Params): Promise<Response> {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.OBCF_R2) return errorResponse('Uploads are not configured', 404, { code: 'NOT_FOUND' });
    const key = (await params).key.join('/');
    // Keys are unique per upload (or cache-busted with ?v=), so browsers may keep them for a year.
    const response = await serveR2Object(env.OBCF_R2, key, { cacheControl: 'public, max-age=31536000, immutable' });
    return response ?? errorResponse('File not found', 404, { code: 'NOT_FOUND' });
}
