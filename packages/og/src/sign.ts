// ============================================================
// @ottabase/og — signed image URLs
// ============================================================
// Every render is a Browser Rendering session the operator pays for, and the route is public
// (link unfurlers carry no session). So the server that emits an image URL signs the card, and
// the route renders only what the server asked for: a stranger can fetch a card the app made,
// never make the app render theirs.
// ============================================================

import { timingSafeEqual } from '@ottabase/utils/hmac-signature';
import { canonicalCard, cardParams, type OgCard } from './card';

export const OG_BASE_PATH = '/api/og';
export const SIGNATURE_PARAM = 'sig';

const encoder = new TextEncoder();

async function hmac(secret: string, message: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
    ]);
    const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The signature of a card under a secret: hex HMAC-SHA256 of its canonical string. */
export const signCard = (secret: string, card: Partial<OgCard>): Promise<string> => hmac(secret, canonicalCard(card));

/** Whether `signature` is the card's, in constant time. */
export async function verifyCard(secret: string, card: Partial<OgCard>, signature: string | null): Promise<boolean> {
    if (!signature) return false;
    return timingSafeEqual(await signCard(secret, card), signature);
}

/**
 * The absolute URL of a card's image, signed. `origin` is the app's (`https://acme.dev`); the
 * route is mounted at `basePath`. Fields the route fills from its defaults (site name, domain,
 * colors, logo) can be left out of the card to keep the URL short.
 */
export async function ogImageUrl(
    origin: string,
    card: OgCard,
    secret: string,
    basePath: string = OG_BASE_PATH,
): Promise<string> {
    const params = cardParams(card);
    params.set(SIGNATURE_PARAM, await signCard(secret, card));
    return `${origin}${basePath}/image?${params.toString()}`;
}
