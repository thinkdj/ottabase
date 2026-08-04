// ============================================================
// @ottabase/premium-webhooks — destination URL policy
// ============================================================
// An outbound webhook is a customer-controlled URL that the SERVER fetches. That is the
// textbook SSRF shape, so the destination is validated on write and the fetch never
// follows redirects.
//
// WHAT THIS CANNOT DO, stated plainly: it cannot stop a hostname that RESOLVES to a
// private address (`webhook.customer.example` → 10.0.0.5). Closing that needs DNS
// resolution before the request and a re-check after, which the Workers runtime does not
// expose. The literal-address and scheme checks below remove the trivial attacks; a
// deployment with genuinely sensitive internal services should send deliveries through
// an egress proxy that enforces the network boundary properly.
// ============================================================

/** Hostnames that never belong to a customer endpoint. */
const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/** Literal private / loopback / link-local IPv4 and IPv6 forms. */
const PRIVATE_ADDRESS_RE =
    /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|\[?(?:fc|fd|fe80|::1)|0x)/i;

/** Suffixes that resolve inside a private network. */
const BLOCKED_SUFFIXES = ['.local', '.internal', '.localhost'];

export class WebhookUrlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WebhookUrlError';
    }
}

/**
 * Validate a destination URL, returning the normalized href.
 *
 * Throws {@link WebhookUrlError} with a message written for the customer — this one is
 * safe to show, because it is entirely about the value they just typed.
 */
export function assertDeliverableUrl(rawUrl: string): string {
    let url: URL;
    try {
        url = new URL(rawUrl.trim());
    } catch {
        throw new WebhookUrlError('Enter a valid absolute URL');
    }

    // HTTPS only. A plaintext webhook leaks the signed payload to every hop, and the
    // signature proves origin, not confidentiality.
    if (url.protocol !== 'https:') {
        throw new WebhookUrlError('Webhook URLs must use https');
    }

    if (url.username || url.password) {
        throw new WebhookUrlError('Webhook URLs must not contain credentials');
    }

    const hostname = url.hostname.toLowerCase();
    if (
        BLOCKED_HOSTNAMES.has(hostname) ||
        PRIVATE_ADDRESS_RE.test(hostname) ||
        BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
    ) {
        throw new WebhookUrlError('Webhook URLs must point at a public host');
    }

    return url.toString();
}
