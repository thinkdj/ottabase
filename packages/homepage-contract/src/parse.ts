import { homepagePublicPayloadV1Schema, type HomepagePublicPayloadV1 } from './schemas';

/**
 * Parse and validate GET /api/homepage/data JSON (throws on invalid v1 payload).
 */
export function parseHomepagePublicPayloadV1(json: unknown): HomepagePublicPayloadV1 {
    return homepagePublicPayloadV1Schema.parse(json);
}

/**
 * Safe parse — returns `null` if not a valid v1 payload.
 */
export function safeParseHomepagePublicPayloadV1(json: unknown): HomepagePublicPayloadV1 | null {
    const r = homepagePublicPayloadV1Schema.safeParse(json);
    return r.success ? r.data : null;
}
