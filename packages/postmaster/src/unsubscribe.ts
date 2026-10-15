import type { SendEmailInput } from '@ottabase/email';

const encoder = new TextEncoder();

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let binary = '';
    for (const byte of view) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(secret: string, message: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
    ]);
    return base64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

export interface UnsubscribeClaims {
    appId: string;
    address: string;
    list: string;
}

export interface UnsubscribeOptions {
    /** HMAC secret. Rotating it invalidates every link in every sent mail; keep it stable. */
    secret: string;
    /** Absolute URL of the unsubscribe route, e.g. `https://app.test/api/email/hooks/unsubscribe`. */
    url: string;
    /** Optional mailto for `List-Unsubscribe`, e.g. `unsubscribe@acme.test`. */
    mailto?: string;
}

/**
 * Signed, stateless unsubscribe links: the token carries who and which list, the signature
 * proves we minted it. No table lookup to verify, and a link stays valid for as long as the
 * secret does, which is what a mail opened a year later needs.
 */
export function createUnsubscribe(options: UnsubscribeOptions) {
    if (!options.secret || options.secret.length < 16) {
        throw new Error('[postmaster] unsubscribe secret must be at least 16 characters');
    }

    async function token(claims: UnsubscribeClaims): Promise<string> {
        const payload = base64Url(
            encoder.encode(JSON.stringify([claims.appId, claims.address.toLowerCase(), claims.list])),
        );
        return `${payload}.${await hmac(options.secret, payload)}`;
    }

    async function verify(value: string | null | undefined): Promise<UnsubscribeClaims | null> {
        if (!value) return null;
        const dot = value.indexOf('.');
        if (dot <= 0) return null;
        const payload = value.slice(0, dot);
        const signature = value.slice(dot + 1);
        if (!timingSafeEqual(signature, await hmac(options.secret, payload))) return null;
        try {
            const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as unknown;
            if (!Array.isArray(parsed) || parsed.length !== 3 || parsed.some((part) => typeof part !== 'string'))
                return null;
            const [appId, address, list] = parsed as [string, string, string];
            return { appId, address, list };
        } catch {
            return null;
        }
    }

    async function link(claims: UnsubscribeClaims): Promise<string> {
        const url = new URL(options.url);
        url.searchParams.set('token', await token(claims));
        return url.toString();
    }

    /** RFC 8058 one-click headers, so mail clients show their own Unsubscribe button. */
    async function headers(claims: UnsubscribeClaims): Promise<Record<string, string>> {
        const href = await link(claims);
        const targets = [options.mailto ? `<mailto:${options.mailto}?subject=unsubscribe>` : null, `<${href}>`].filter(
            Boolean,
        );
        return {
            'List-Unsubscribe': targets.join(', '),
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        };
    }

    /** The message with the headers added, for a single recipient. */
    async function withHeaders<T extends Pick<SendEmailInput, 'headers'>>(
        input: T,
        claims: UnsubscribeClaims,
    ): Promise<Omit<T, 'headers'> & { headers: Record<string, string> }> {
        return { ...input, headers: { ...(input.headers ?? {}), ...(await headers(claims)) } };
    }

    return { token, verify, link, headers, withHeaders };
}

export type Unsubscribe = ReturnType<typeof createUnsubscribe>;
