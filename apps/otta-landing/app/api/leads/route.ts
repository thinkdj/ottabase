// POST /api/leads — the contact and signup forms (LeadForm). Stores the entry in the shared D1;
// otta-web shows it in the admin inbox and emails the digest.

import { LandingLead } from '@ottabase/ottalanding';
import { DomainValidationError } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { connect } from '../../../lib/content';

/** Far above any real entry (a 4,000-character message), far below anything abusive. */
const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: Request): Promise<Response> {
    // JSON only: a browser can't send it cross-site without a CORS preflight, which this route never allows.
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        return errorResponse('Expected a JSON body', 415, { code: 'UNSUPPORTED_MEDIA_TYPE' });
    }
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES)
        return errorResponse('That message is too long', 413, { code: 'PAYLOAD_TOO_LARGE' });
    let body: unknown;
    try {
        body = JSON.parse(text);
    } catch {
        return errorResponse('Expected a JSON body', 400, { code: 'BAD_REQUEST' });
    }

    const appId = await connect();
    try {
        const outcome = await LandingLead.submit(appId, body, { ipHash: await networkHash(appId, request) });
        if (outcome === 'rate-limited') {
            return errorResponse('Too many messages from your network. Please try again in a few minutes.', 429, {
                code: 'RATE_LIMITED',
            });
        }
        return jsonResponse({ ok: true });
    } catch (error) {
        if (error instanceof DomainValidationError) {
            return errorResponse(error.message, error.status, { code: error.code, fieldErrors: error.fieldErrors });
        }
        throw error;
    }
}

/** The visitor's network as a salted hash: enough to rate-limit, without storing the IP address. */
async function networkHash(appId: string, request: Request): Promise<string | undefined> {
    const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (!ip) return undefined;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${appId}:${ip}`));
    return [...new Uint8Array(digest)]
        .slice(0, 16)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
