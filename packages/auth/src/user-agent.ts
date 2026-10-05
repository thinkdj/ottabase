// Turning a User-Agent string into words for the account page's device list. No parser
// dependency: the handful of browser and platform names people recognise is enough.

const BROWSERS: [RegExp, string][] = [
    [/Edg\//, 'Edge'],
    [/OPR\/|Opera/, 'Opera'],
    [/SamsungBrowser/, 'Samsung Internet'],
    [/Chrome\/|CriOS\//, 'Chrome'],
    [/Firefox\/|FxiOS\//, 'Firefox'],
    [/Safari\//, 'Safari'],
];

const PLATFORMS: [RegExp, string][] = [
    [/iPhone/, 'iPhone'],
    [/iPad/, 'iPad'],
    [/Android/, 'Android'],
    [/Windows/, 'Windows'],
    [/Mac OS X|Macintosh/, 'macOS'],
    [/CrOS/, 'ChromeOS'],
    [/Linux/, 'Linux'],
];

/** "Chrome on Windows", "Safari on iPhone", or "Unknown device" when nothing is recognised. */
export function describeUserAgent(userAgent: string | null | undefined): string {
    const ua = userAgent ?? '';
    const browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1];
    const platform = PLATFORMS.find(([pattern]) => pattern.test(ua))?.[1];
    if (browser && platform) return `${browser} on ${platform}`;
    return browser ?? platform ?? 'Unknown device';
}
