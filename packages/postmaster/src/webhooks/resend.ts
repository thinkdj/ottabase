import type { ProviderEvent } from '../types';
import { timingSafeEqual } from '@ottabase/utils/hmac-signature';

const encoder = new TextEncoder();

/**
 * Resend signs webhooks the Svix way: `svix-id`, `svix-timestamp`, `svix-signature`
 * (`v1,<base64>`, several allowed, space-separated), HMAC-SHA256 over `${id}.${ts}.${body}`
 * with the secret after `whsec_` base64-decoded. Timestamps older than five minutes are refused.
 */
export async function verifyResendSignature(
    request: { headers: Headers },
    body: string,
    secret: string,
    now: number = Date.now(),
): Promise<boolean> {
    const id = request.headers.get('svix-id');
    const timestamp = request.headers.get('svix-timestamp');
    const signatures = request.headers.get('svix-signature');
    if (!id || !timestamp || !signatures) return false;
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;

    const raw = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
    let keyBytes: Uint8Array<ArrayBuffer>;
    try {
        const binary = atob(raw);
        keyBytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) keyBytes[i] = binary.charCodeAt(i);
    } catch {
        return false;
    }
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(`${id}.${timestamp}.${body}`));
    const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));

    return signatures.split(' ').some((entry) => {
        const [version, value] = entry.split(',');
        return version === 'v1' && !!value && timingSafeEqual(value, expected);
    });
}

interface ResendPayload {
    type?: string;
    data?: { email_id?: string; to?: string[] | string; bounce?: { type?: string } };
}

/** Normalise one Resend event. Unknown types come back as `other` so a host can still log them. */
export function parseResendEvent(body: unknown): ProviderEvent | null {
    const payload = body as ResendPayload | null;
    if (!payload || typeof payload !== 'object' || typeof payload.type !== 'string') return null;
    const to = payload.data?.to;
    const addresses = (Array.isArray(to) ? to : to ? [to] : []).map((address) => address.toLowerCase());
    const base = {
        provider: 'resend' as const,
        raw: payload.type,
        addresses,
        messageId: payload.data?.email_id ?? null,
    };
    switch (payload.type) {
        case 'email.bounced': {
            const kind = payload.data?.bounce?.type?.toLowerCase();
            return { ...base, type: 'bounce', bounce: kind === 'transient' || kind === 'soft' ? 'soft' : 'hard' };
        }
        case 'email.complained':
            return { ...base, type: 'complaint' };
        case 'email.delivered':
            return { ...base, type: 'delivered' };
        default:
            return { ...base, type: 'other' };
    }
}
