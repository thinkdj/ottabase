/**
 * Turnstile: Cloudflare's bot check for forms a stranger can submit.
 *
 * The browser renders the widget (`@ottabase/ui/turnstile`) and sends its token in the
 * `X-Turnstile-Token` header; the route calls `requireHuman` before doing any work. Tokens are
 * single use, valid five minutes, and minted for one action, so a token from the subscribe form
 * is refused at sign-in.
 *
 * No secret configured: every check passes, so local runs and tests need nothing. Cloudflare's
 * test keys (`TURNSTILE_TEST_KEYS`) work on any hostname, localhost included.
 *
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

import { errorResponse } from '@ottabase/utils/http-errors';

/** The request header that carries the widget's token. */
export const TURNSTILE_HEADER = 'X-Turnstile-Token';

/** The widget script, explicit rendering (the page decides where and when). */
export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Cloudflare's published test keys. Test secrets accept only the dummy token; real secrets refuse it. */
export const TURNSTILE_TEST_KEYS = {
    site: {
        pass: '1x00000000000000000000AA',
        block: '2x00000000000000000000AB',
        passInvisible: '1x00000000000000000000BB',
        blockInvisible: '2x00000000000000000000BB',
        interactive: '3x00000000000000000000FF',
    },
    secret: {
        pass: '1x0000000000000000000000000000000AA',
        fail: '2x0000000000000000000000000000000AA',
        spent: '3x0000000000000000000000000000000AA',
    },
    token: 'XXXX.DUMMY.TOKEN.XXXX',
} as const;

/** Cloudflare's rule for an action: up to 32 letters, digits, `_` and `-`. */
export const TURNSTILE_ACTION_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

const TOKEN_MAX_LENGTH = 2048;
const DEFAULT_TIMEOUT_MS = 5000;
const TEST_SECRETS: readonly string[] = Object.values(TURNSTILE_TEST_KEYS.secret);

export type TurnstileFailure =
    /** No token sent. */
    | 'missing'
    /** Cloudflare refused the token: forged, expired or for another site. */
    | 'invalid'
    /** The token was already used. */
    | 'spent'
    /** The token was minted for another form. */
    | 'action'
    /** The token was minted on another site. */
    | 'hostname'
    /** Siteverify could not be reached or answered with an error of its own. */
    | 'unavailable';

export type TurnstileVerdict = { ok: true } | { ok: false; reason: TurnstileFailure; codes: string[] };

export interface VerifyTurnstileInput {
    secret: string;
    token: string | null | undefined;
    /** The action the form's widget was rendered with. */
    action: string;
    /** The hostname the page was served on. Unset: not checked. */
    hostname?: string;
    remoteip?: string;
    /** Abort siteverify after this long and treat it as unreachable. Default 5000. */
    timeoutMs?: number;
    fetch?: typeof fetch;
}

interface SiteverifyBody {
    success?: boolean;
    hostname?: string;
    action?: string;
    'error-codes'?: string[];
}

/** Ask Cloudflare whether a token is genuine, unused, and minted for this action and hostname. */
export async function verifyTurnstile(input: VerifyTurnstileInput): Promise<TurnstileVerdict> {
    const token = input.token?.trim();
    if (!token) return { ok: false, reason: 'missing', codes: [] };
    if (token.length > TOKEN_MAX_LENGTH) return { ok: false, reason: 'invalid', codes: ['invalid-input-response'] };

    const form = new URLSearchParams({ secret: input.secret, response: token });
    if (input.remoteip) form.set('remoteip', input.remoteip);

    let body: SiteverifyBody;
    try {
        const response = await (input.fetch ?? fetch)(TURNSTILE_SITEVERIFY_URL, {
            method: 'POST',
            body: form,
            signal: AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        });
        if (!response.ok) return { ok: false, reason: 'unavailable', codes: [`http-${response.status}`] };
        body = (await response.json()) as SiteverifyBody;
    } catch {
        return { ok: false, reason: 'unavailable', codes: ['network'] };
    }

    const codes = Array.isArray(body['error-codes']) ? body['error-codes'] : [];
    if (body.success !== true) {
        if (codes.indexOf('timeout-or-duplicate') !== -1) return { ok: false, reason: 'spent', codes };
        // Our own key or Cloudflare's side, not the visitor's token.
        if (codes.some((code) => code === 'internal-error' || code.includes('input-secret'))) {
            return { ok: false, reason: 'unavailable', codes };
        }
        return { ok: false, reason: 'invalid', codes };
    }
    // Test secrets answer with sample values, so only a real key's answer is compared.
    if (TEST_SECRETS.indexOf(input.secret) === -1) {
        if (body.action !== input.action) return { ok: false, reason: 'action', codes };
        if (input.hostname && body.hostname !== input.hostname) return { ok: false, reason: 'hostname', codes };
    }
    return { ok: true };
}

export interface RequireHumanOptions {
    /** The secret key. Unset or empty: the check is off and every request passes. */
    secret: string | null | undefined;
    /** The form's action, the same string its widget was rendered with. */
    action: string;
    /**
     * What to do when Cloudflare cannot be reached. `refuse` for forms that mail an address or
     * create something; `allow` (logged) where another gate still holds, such as password sign-in
     * behind its rate limit, so a Cloudflare incident does not lock everyone out.
     */
    unreachable: 'refuse' | 'allow';
    /** Expected hostname. Default: the request's own, which is the page's for same-origin forms. */
    hostname?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
}

/**
 * The 403 to return when a request did not come from a person who passed the widget, else null.
 * Put the rate limit first: it is cheap and keeps a flood away from siteverify.
 */
export async function requireHuman(request: Request, options: RequireHumanOptions): Promise<Response | null> {
    if (!options.secret) return null;
    const verdict = await verifyTurnstile({
        secret: options.secret,
        token: request.headers.get(TURNSTILE_HEADER),
        action: options.action,
        hostname: options.hostname ?? new URL(request.url).hostname,
        remoteip: request.headers.get('CF-Connecting-IP') ?? undefined,
        timeoutMs: options.timeoutMs,
        fetch: options.fetch,
    });
    if (verdict.ok) return null;

    if (verdict.reason === 'unavailable') {
        if (options.unreachable === 'allow') {
            console.warn(
                `[turnstile] siteverify unavailable for "${options.action}", let through: ${verdict.codes.join(',')}`,
            );
            return null;
        }
        return errorResponse('The bot check is unavailable. Please try again in a moment.', 503, {
            code: 'TURNSTILE_UNAVAILABLE',
        });
    }
    return errorResponse('Please complete the bot check and try again.', 403, {
        code: 'TURNSTILE_FAILED',
        metadata: { reason: verdict.reason },
    });
}
