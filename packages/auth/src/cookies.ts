// ============================================================
// @ottabase/auth - Cookie helpers
// ============================================================

export interface CookieOptions {
    maxAgeSeconds?: number;
    path?: string;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    httpOnly?: boolean;
    domain?: string;
}

// RFC 6265 cookie-name token chars; a cookie value must not contain control chars,
// whitespace, quotes, comma, semicolon or backslash (which would inject attributes or
// corrupt the Set-Cookie header). We reject rather than silently truncate.
const COOKIE_NAME_RE = /^[!#$%&'*+._`|~0-9A-Za-z^-]+$/;
const COOKIE_VALUE_INVALID_RE = /[\x00-\x20\x7f",;\\]/;

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
    if (!COOKIE_NAME_RE.test(name)) {
        throw new Error(`Invalid cookie name: ${JSON.stringify(name)}`);
    }
    if (value !== '' && COOKIE_VALUE_INVALID_RE.test(value)) {
        throw new Error(`Invalid cookie value for ${name}: contains disallowed characters`);
    }

    const { maxAgeSeconds, path = '/', secure = true, sameSite = 'Lax', httpOnly = true, domain } = options;
    const parts = [`${name}=${value}`, `Path=${path}`];

    if (typeof maxAgeSeconds === 'number') {
        parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`);
    }
    if (domain) parts.push(`Domain=${domain}`);
    parts.push(`SameSite=${sameSite}`);
    if (httpOnly) parts.push('HttpOnly');
    // SameSite=None requires Secure per the cookie spec; always set Secure in that case.
    if (secure || sameSite === 'None') parts.push('Secure');

    return parts.join('; ');
}

export function clearCookie(
    name: string,
    options: Pick<CookieOptions, 'path' | 'secure' | 'sameSite' | 'domain'> = {},
): string {
    return serializeCookie(name, '', { ...options, maxAgeSeconds: 0 });
}

export function parseCookies(header: string | null): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!header) return cookies;

    for (const part of header.split(';')) {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex === -1) continue;

        const key = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();
        if (!key) continue;

        try {
            cookies[key] = decodeURIComponent(value);
        } catch {
            cookies[key] = value;
        }
    }

    return cookies;
}

/** Whether the incoming request should be treated as HTTPS (direct or behind a trusted proxy header). */
export function isHttpsRequest(request: Request): boolean {
    const url = new URL(request.url);
    if (url.protocol === 'https:') return true;

    const forwardedProto = request.headers.get('x-forwarded-proto');
    return (forwardedProto?.split(',')[0]?.trim().toLowerCase() ?? '') === 'https';
}
