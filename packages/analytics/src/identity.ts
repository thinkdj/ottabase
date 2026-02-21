/**
 * @ottabase/analytics — Visitor Identity
 *
 * Pluggable visitor identification for analytics.
 *
 * The default strategy hashes IP + User-Agent + a weekly salt to produce a
 * privacy-friendly visitor ID that is:
 * - Deterministic within a 7-day window (same visitor = same hash)
 * - Rotated weekly (prevents long-term tracking beyond 7 days)
 * - Not PII (irreversible hash, not raw IP)
 *
 * To swap the strategy (e.g. use a cookie, CF-Ray, or authenticated userId),
 * call `setVisitorIdResolver()` once at startup.
 */

/**
 * Function that resolves a visitor identifier from a request.
 * Must return a string (max 32 chars for WAE index, but we store it in a blob).
 */
export type VisitorIdResolver = (request: Request) => string | Promise<string>;

/** The active resolver — defaults to {@link defaultVisitorIdResolver}. */
let activeResolver: VisitorIdResolver = defaultVisitorIdResolver;

/**
 * Replace the visitor ID strategy globally.
 *
 * @example
 * ```ts
 * // Use authenticated userId when available, fallback to default
 * setVisitorIdResolver(async (request) => {
 *   const session = await getSession(request);
 *   if (session?.user?.id) return session.user.id;
 *   return defaultVisitorIdResolver(request);
 * });
 * ```
 */
export function setVisitorIdResolver(resolver: VisitorIdResolver): void {
    activeResolver = resolver;
}

/** Reset to the built-in default resolver (useful in tests). */
export function resetVisitorIdResolver(): void {
    activeResolver = defaultVisitorIdResolver;
}

/**
 * Resolve a visitor ID for the given request using the active strategy.
 *
 * @example
 * ```ts
 * const visitorId = await resolveVisitorId(request);
 * trackCoreEvent({ ..., visitorId });
 * ```
 */
export async function resolveVisitorId(request: Request): Promise<string> {
    return activeResolver(request);
}

/**
 * Default visitor ID: deterministic weekly hash of IP + User-Agent.
 *
 * Uses the Web Crypto API (available in Workers) to SHA-256 hash the
 * concatenation of: IP address + User-Agent + week salt.
 * Returns the first 16 hex chars (64-bit uniqueness — sufficient for
 * approximate unique counting, not globally unique).
 *
 * The week salt rotates every 7 days (ISO week number + year), so the
 * same visitor produces the same hash within a week but a different
 * hash the following week.
 *
 * Privacy properties:
 * - Cannot reconstruct IP from the hash
 * - Rotates weekly (limits tracking window to 7 days)
 * - No cookies, no localStorage, works in incognito
 */
export async function defaultVisitorIdResolver(request: Request): Promise<string> {
    const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';
    const ua = request.headers.get('user-agent') ?? '';

    const raw = `${ip}|${ua}|${weekSalt()}`;
    const hash = await sha256Hex(raw);
    return hash.slice(0, 16); // 16 hex chars = 64-bit
}

/**
 * SHA-256 hash using Web Crypto API (available in Workers and browsers).
 * Returns full hex string.
 */
async function sha256Hex(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Synchronous fallback: simple FNV-1a 32-bit hash.
 * Use when async is not an option (edge cases).
 * Less collision-resistant than SHA-256 but still good enough for counting.
 */
export function fastVisitorHash(request: Request): string {
    const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';
    const ua = request.headers.get('user-agent') ?? '';
    const raw = `${ip}|${ua}|${weekSalt()}`;
    return fnv1a32(raw);
}

/**
 * Compute a weekly salt string: `"YYYY-Www"` (ISO week number).
 * Same value for all days within the same Mon–Sun week.
 *
 * @example weekSalt() // "2026-W08"
 */
function weekSalt(): string {
    const now = new Date();
    // ISO week: the week containing the year's first Thursday
    const jan4 = new Date(now.getFullYear(), 0, 4);
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86_400_000) + 1;
    const dayOfWeek = now.getDay() || 7; // Mon=1 … Sun=7
    const weekNum = Math.ceil((dayOfYear - dayOfWeek + 10) / 7);
    return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** FNV-1a 32-bit hash → 8-char hex string. */
function fnv1a32(input: string): string {
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193); // FNV prime
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}
