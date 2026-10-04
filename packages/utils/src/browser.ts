'use client';

/**
 * Check if running in a browser environment.
 * More comprehensive check that verifies both window and document objects.
 */
export function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

/**
 * Check if running on a mobile browser.
 * Uses user agent detection to identify mobile devices.
 */
export function isMobileBrowser(): boolean {
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    return false;
}

/**
 * Get detailed browser information.
 * Only works in browser environments.
 */
export function getBrowserInfo(): {
    isBrowser: boolean;
    isMobile: boolean;
    userAgent: string | null;
    platform: string | null;
    language: string | null;
    cookieEnabled: boolean;
    onLine: boolean;
} {
    if (!isBrowser()) {
        return {
            isBrowser: false,
            isMobile: false,
            userAgent: null,
            platform: null,
            language: null,
            cookieEnabled: false,
            onLine: false,
        };
    }

    return {
        isBrowser: true,
        isMobile: isMobileBrowser(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
    };
}

/**
 * Get viewport dimensions.
 * Returns null if not in browser environment.
 */
export function getViewportSize(): { width: number; height: number } | null {
    if (!isBrowser()) return null;

    return {
        width: window.innerWidth,
        height: window.innerHeight,
    };
}

/**
 * Check if the browser supports a specific feature.
 */
export function supportsFeature(feature: string): boolean {
    if (!isBrowser()) return false;

    switch (feature.toLowerCase()) {
        case 'localstorage':
            return typeof Storage !== 'undefined';
        case 'sessionstorage':
            return typeof Storage !== 'undefined';
        case 'geolocation':
            return 'geolocation' in navigator;
        case 'webgl':
            try {
                const canvas = document.createElement('canvas');
                return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
            } catch {
                return false;
            }
        case 'serviceworker':
            return 'serviceWorker' in navigator;
        case 'pushnotifications':
            return 'PushManager' in window;
        default:
            return false;
    }
}

/**
 * Get browser name and version.
 */
export function getBrowserDetails(): { name: string; version: string } | null {
    if (!isBrowser()) return null;

    const userAgent = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';

    // Chrome
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
        browserName = 'Chrome';
        const match = userAgent.match(/Chrome\/(\d+)/);
        browserVersion = match ? match[1] : 'Unknown';
    }
    // Firefox
    else if (userAgent.includes('Firefox')) {
        browserName = 'Firefox';
        const match = userAgent.match(/Firefox\/(\d+)/);
        browserVersion = match ? match[1] : 'Unknown';
    }
    // Safari
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        browserName = 'Safari';
        const match = userAgent.match(/Version\/(\d+)/);
        browserVersion = match ? match[1] : 'Unknown';
    }
    // Edge
    else if (userAgent.includes('Edg')) {
        browserName = 'Edge';
        const match = userAgent.match(/Edg\/(\d+)/);
        browserVersion = match ? match[1] : 'Unknown';
    }

    return { name: browserName, version: browserVersion };
}

/**
 * Save text as a file in the browser (CSV, JSON, Markdown…).
 * No-op outside a browser.
 */
export function downloadTextFile(content: string, filename: string, type = 'text/plain;charset=utf-8'): void {
    if (!isBrowser()) return;
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    // Revoke after the click has been handled so slower browsers still get the file
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Serialize rows to CSV (RFC 4180): quotes fields containing commas, quotes or
 * newlines, doubles inner quotes, and neutralises spreadsheet formula injection
 * (cells starting with = + - @ get a leading apostrophe).
 */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
    const cell = (value: string | number | null | undefined) => {
        let text = value == null ? '' : String(value);
        if (/^[=+\-@]/.test(text)) text = `'${text}`;
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}
