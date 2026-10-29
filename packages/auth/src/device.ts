// ============================================================
// @ottabase/auth - Device facts for the sessions page
// ============================================================
// Small, dependency-free parsing: "Chrome on Windows", a masked IP
// and "City, CC" from Cloudflare's request geolocation. Stored as KV
// key metadata next to the session registry record.
// ============================================================

/** What a session remembers about the device that opened it. */
export interface SessionDevice {
    /** "Chrome on Windows", "Safari on iPhone" */
    userAgent?: string | null;
    /** Masked: last IPv4 octet / IPv6 tail replaced (`203.0.113.x`). */
    ip?: string | null;
    /** "Mumbai, IN" */
    geo?: string | null;
}

const BROWSERS: Array<[RegExp, string]> = [
    [/\bEdg(?:e|A|iOS)?\/\d/i, 'Edge'],
    [/\bOPR\/\d|\bOpera\b/i, 'Opera'],
    [/\bSamsungBrowser\/\d/i, 'Samsung Internet'],
    [/\bFirefox\/\d|\bFxiOS\/\d/i, 'Firefox'],
    [/\bCriOS\/\d/i, 'Chrome'],
    [/\bChrome\/\d/i, 'Chrome'],
    [/\bSafari\/\d/i, 'Safari'],
    [/\bcurl\/\d/i, 'curl'],
];

const PLATFORMS: Array<[RegExp, string]> = [
    [/\biPhone\b/i, 'iPhone'],
    [/\biPad\b/i, 'iPad'],
    [/\bAndroid\b/i, 'Android'],
    [/\bWindows\b/i, 'Windows'],
    [/\bMac OS X\b|\bMacintosh\b/i, 'macOS'],
    [/\bCrOS\b/i, 'ChromeOS'],
    [/\bLinux\b/i, 'Linux'],
];

/** "Chrome on Windows". Unknown parts are left out; an empty UA gives "Unknown device". */
export function describeUserAgent(userAgent: string | null | undefined): string {
    if (!userAgent) return 'Unknown device';
    const browser = BROWSERS.find(([re]) => re.test(userAgent))?.[1];
    const platform = PLATFORMS.find(([re]) => re.test(userAgent))?.[1];
    if (browser && platform) return `${browser} on ${platform}`;
    return browser ?? platform ?? 'Unknown device';
}

/** `203.0.113.42` → `203.0.113.x`; `2001:db8:85a3::8a2e:370:7334` → `2001:db8:85a3:…`. */
export function maskIp(ip: string | null | undefined): string | null {
    if (!ip) return null;
    const trimmed = ip.trim();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) return trimmed.replace(/\.\d{1,3}$/, '.x');
    if (trimmed.includes(':')) {
        const groups = trimmed.split(':').filter((g, i, all) => g !== '' || i === 0 || i === all.length - 1);
        return `${groups.slice(0, 3).join(':')}:…`;
    }
    return null;
}

/** Device facts from a request: UA summary, masked connecting IP and Cloudflare's city/country. */
export function describeRequestDevice(request: Request): SessionDevice {
    const cf = (request as Request & { cf?: { city?: unknown; country?: unknown } }).cf;
    const city = typeof cf?.city === 'string' ? cf.city : '';
    const country = typeof cf?.country === 'string' ? cf.country : request.headers.get('cf-ipcountry') || '';
    const geo = [city, country].filter(Boolean).join(', ') || null;
    return {
        userAgent: describeUserAgent(request.headers.get('user-agent')),
        ip: maskIp(request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]),
        geo,
    };
}
