// ============================================================
// @ottabase/webhooks — request signing
// ============================================================
// HMAC-SHA256 over `<timestamp>.<body>`, in a Stripe-shaped header:
//
//     X-Ottabase-Signature: t=1735689600,v1=<hex>
//
// THE TIMESTAMP IS INSIDE THE SIGNED STRING, not merely alongside it, so a receiver can
// reject anything older than its own tolerance. The scheme lives in
// `@ottabase/utils/hmac-signature`, shared with the webhook channels of `@ottabase/alerts`:
// one verifier on the receiving side checks both. This file keeps the header names and the
// functions this package has always exported.
// ============================================================

export {
    buildSignatureHeader,
    generateSigningSecret,
    signPayload,
    verifySignatureHeader,
} from '@ottabase/utils/hmac-signature';

/** Header carrying the signature. */
export const SIGNATURE_HEADER = 'X-Ottabase-Signature';
/** Header carrying the event name, so a receiver can route without parsing the body. */
export const EVENT_HEADER = 'X-Ottabase-Event';
/** Header carrying the delivery id, for idempotent receivers. */
export const DELIVERY_HEADER = 'X-Ottabase-Delivery';
