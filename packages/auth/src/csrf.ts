// ============================================================
// @ottabase/auth - CSRF protection (double-submit cookie)
// ============================================================
//
// GET /api/auth/csrf sets an HttpOnly cookie containing
// `token.hmac(token)` and returns the plain `token` in the JSON body.
// State-changing requests must echo that plain token back; the server
// re-derives the HMAC from the cookie and compares. An attacker who can
// only trigger a cross-site request (and never read the JSON response,
// per same-origin policy) cannot learn the plain token, so they cannot
// construct a valid request even though the cookie itself is replayed
// automatically by the browser.
//
// ============================================================

import { hmacSign, hmacVerify, randomToken, timingSafeEqualString } from './crypto';

export interface CsrfCookiePair {
    /** Plain token to hand back to the client in the JSON response body. */
    token: string;
    /** Value to store in the HttpOnly cookie: `token.signature`. */
    cookieValue: string;
}

export async function createCsrfCookiePair(secret: string): Promise<CsrfCookiePair> {
    const token = randomToken(24);
    const signature = await hmacSign(token, secret);
    return { token, cookieValue: `${token}.${signature}` };
}

export async function verifyCsrfToken(
    cookieValue: string | undefined,
    submittedToken: string | undefined,
    secret: string,
): Promise<boolean> {
    if (!cookieValue || !submittedToken) return false;

    const separatorIndex = cookieValue.lastIndexOf('.');
    if (separatorIndex === -1) return false;

    const token = cookieValue.slice(0, separatorIndex);
    const signature = cookieValue.slice(separatorIndex + 1);

    const validSignature = await hmacVerify(token, signature, secret);
    if (!validSignature) return false;

    return timingSafeEqualString(token, submittedToken);
}
