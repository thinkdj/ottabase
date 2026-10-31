// Images picked from otta-web's media library (logos, hero shots, social images) are public
// files: `<R2_PUBLIC_URL>/<key>`, by default /api/files/public/<key>. Serving that same path
// from the same PUBLIC bucket makes those URLs work here unchanged and keeps the site's images
// on its own origin. Only the public bucket is bound: private files and backups live in buckets
// this app never sees, so no key can reach them.

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { servePublicFile } from '@ottabase/ottaupload/server';
import { errorResponse } from '@ottabase/utils/http-errors';

type Params = { params: Promise<{ key: string[] }> };

async function serve(request: Request, { params }: Params): Promise<Response> {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.OBCF_R2) return errorResponse('Files are not configured', 404, { code: 'NOT_FOUND' });
    const key = (await params).key.join('/');
    // Keys are never reused, so the response is immutable: ETag/304, Range, the safe headers.
    const response = await servePublicFile(env.OBCF_R2 as never, request, key);
    return response ?? errorResponse('File not found', 404, { code: 'NOT_FOUND' });
}

export const GET = serve;
export const HEAD = serve;
