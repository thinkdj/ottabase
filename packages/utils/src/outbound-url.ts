// ============================================================
// @ottabase/utils/outbound-url: is this a URL the server may fetch?
// ============================================================
// A URL an operator or a customer types in, which the SERVER then fetches (a webhook, an
// alert channel), is the textbook SSRF shape. It is validated on write here, and the fetch
// that uses it must never follow redirects.
//
// WHAT THIS CANNOT DO, stated plainly: it cannot stop a hostname that RESOLVES to a
// private address (`hooks.customer.example` → 10.0.0.5). Closing that needs DNS
// resolution before the request and a re-check after, which the Workers runtime does not
// expose. The literal-address and scheme checks below remove the trivial attacks; a
// deployment with genuinely sensitive internal services should send these requests
// through an egress proxy that enforces the network boundary properly.
//
// Used by @ottabase/webhooks (endpoints) and @ottabase/alerts (webhook channels).
// ============================================================

/** Hostnames that never belong to a public endpoint. */
const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/** Literal private, loopback, link-local and carrier-grade NAT IPv4 ranges, and hex notation. */
const PRIVATE_IPV4_RE =
    /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|0x)/i;

/** Suffixes that resolve inside a private network. */
const BLOCKED_SUFFIXES = ['.local', '.internal', '.localhost'];

/** The value typed in is not a URL the server may fetch. The message is safe to show: it is about that value. */
export class OutboundUrlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OutboundUrlError';
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

/** True when the hostname is a literal private address or a private-network name. */
export function isPrivateHostname(hostname: string): boolean {
    // `localhost.` is a fully qualified `localhost`; the URL parser keeps the dot.
    const host = hostname.toLowerCase().replace(/\.+$/, '');
    return (
        BLOCKED_HOSTNAMES.has(host) ||
        PRIVATE_IPV4_RE.test(host) ||
        isBlockedIpv6(host) ||
        BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))
    );
}

/**
 * Validate a URL the server will fetch, returning the normalized href. HTTPS only (a
 * plaintext request leaks whatever it carries to every hop), no embedded credentials, and
 * no literal private host.
 *
 * Throws {@link OutboundUrlError}. `noun` names the thing in the message: "Webhook URLs must
 * use https".
 */
export function assertPublicHttpsUrl(rawUrl: string, noun = 'URLs'): string {
    let url: URL;
    try {
        url = new URL(rawUrl.trim());
    } catch {
        throw new OutboundUrlError('Enter a valid absolute URL');
    }
    if (url.protocol !== 'https:') throw new OutboundUrlError(`${noun} must use https`);
    if (url.username || url.password) throw new OutboundUrlError(`${noun} must not contain credentials`);
    if (isPrivateHostname(url.hostname)) throw new OutboundUrlError(`${noun} must point at a public host`);
    return url.toString();
}
