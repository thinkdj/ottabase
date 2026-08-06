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

/** Literal private, loopback and link-local IPv4 ranges. */
const PRIVATE_IPV4_RE =
    /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|0x)/i;

/** Suffixes that resolve inside a private network. */
const BLOCKED_SUFFIXES = ['.local', '.internal', '.localhost'];

export class WebhookUrlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WebhookUrlError';
    }
}

/**
 * Parse the bracket-less serialized IPv6 host into its eight 16-bit groups.
 *
 * `URL` already rejects malformed addresses and normalizes embedded IPv4 notation, so
 * this only needs to handle the standard compressed IPv6 form. Keeping the check here
 * avoids a Node-only IP helper in Worker code.
 */
function parseIpv6Groups(hostname: string): number[] | null {
    const host = hostname.replace(/^\[|\]$/g, '');
    if (!host.includes(':') || host.includes('.')) return null;

    const halves = host.split('::');
    if (halves.length > 2) return null;
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const parts = [...left, ...right];
    if (parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) return null;

    if (halves.length === 1 && parts.length !== 8) return null;
    if (halves.length === 2 && parts.length >= 8) return null;

    return [...left, ...Array(8 - parts.length).fill('0'), ...right].map((part) => Number.parseInt(part, 16));
}

function isBlockedIpv6(hostname: string): boolean {
    const groups = parseIpv6Groups(hostname);
    if (!groups) return false;

    const isAllZero = groups.every((group) => group === 0);
    const isLoopback = groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1;
    const isIpv4Compatible = groups.slice(0, 6).every((group) => group === 0);
    const isIpv4Mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
    const isUniqueLocal = groups[0] >= 0xfc00 && groups[0] <= 0xfdff;
    const isLinkLocal = groups[0] >= 0xfe80 && groups[0] <= 0xfebf;

    // IPv4-mapped hosts are an easy way to hide a loopback/private IPv4 target. Block
    // the mapped range as a whole instead of depending on a second, subtly different
    // IPv4 parser for its final 32 bits.
    return isAllZero || isLoopback || isIpv4Compatible || isIpv4Mapped || isUniqueLocal || isLinkLocal;
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
        PRIVATE_IPV4_RE.test(hostname) ||
        isBlockedIpv6(hostname) ||
        BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
    ) {
        throw new WebhookUrlError('Webhook URLs must point at a public host');
    }

    return url.toString();
}
