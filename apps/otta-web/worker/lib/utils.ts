export async function readJson<T = any>(request: Request): Promise<T> {
    try {
        return (await request.json()) as T;
    } catch {
        // @ts-expect-error - ok
        return {} as T;
    }
}

export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function isStrongPassword(password: string): boolean {
    if (password.length < 8) return false;
    return /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(password);
}

export function isValidIpAddress(rawValue: string | null): string {
    if (!rawValue) {
        return 'unknown';
    }

    const firstSegment = rawValue.split(',')[0];
    const candidate = firstSegment ? firstSegment.trim() : '';
    if (!candidate) {
        return 'unknown';
    }

    const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^[0-9a-fA-F:]+$/;

    if (ipv4Regex.test(candidate)) {
        const parts = candidate.split('.');
        const validOctets = parts.every((part) => {
            const n = Number(part);
            return Number.isInteger(n) && n >= 0 && n <= 255;
        });
        if (!validOctets) {
            return 'unknown';
        }
        return candidate;
    }

    if (ipv6Regex.test(candidate) && candidate.includes(':')) {
        return candidate;
    }

    return 'unknown';
}

export function getClientIpAddress(request: Request): string {
    const headerCandidates = ['CF-Connecting-IP', 'X-Forwarded-For', 'X-Real-IP', 'True-Client-IP', 'Fastly-Client-IP'];

    for (const header of headerCandidates) {
        const headerValue = request.headers.get(header);
        const validIp = isValidIpAddress(headerValue);
        if (validIp !== 'unknown') {
            return validIp;
        }
    }

    // Fallback to host (useful in local dev)
    const host = request.headers.get('host');
    const hostIp = host ? host.split(':')[0] : null;
    const validHostIp = isValidIpAddress(hostIp);
    if (validHostIp !== 'unknown') {
        return validHostIp;
    }

    // Final fallback to loopback for local development
    return '127.0.0.1';
}

export function base64UrlEncode(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createSecureToken(bytes = 32): string {
    const buffer = crypto.getRandomValues(new Uint8Array(bytes));
    return base64UrlEncode(buffer);
}
