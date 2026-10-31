// ============================================================
// Turnstile for otta-web: the bot check on every form a stranger can submit
// ============================================================
// The check itself is `requireHuman` in @ottabase/cf/turnstile; this file binds it to the app's
// env and rate limiter. A public form's handler calls one line:
//
//     const denied = await guardPublicForm(request, env, { action: 'register', key: `auth:register:${ip}`, unreachable: 'refuse' });
//     if (denied) return denied;
//
// and its page renders `useTurnstile('register')` from @ottabase/ui/turnstile. The action names
// both sides use are TURNSTILE_ACTIONS in ottabase/turnstile.ts.
//
// Checks run only when TURNSTILE_SITE_KEY (a var) and TURNSTILE_SECRET_KEY (a secret) are both set:
// a secret alone would refuse every form, since no page would render a widget to answer it.
// ============================================================

import { requireHuman as checkHuman, type RequireHumanOptions } from '@ottabase/cf/turnstile';
import { enforceRateLimit } from './rate-limiting';

type TurnstileEnv = Pick<CloudflareEnv, 'TURNSTILE_SITE_KEY' | 'TURNSTILE_SECRET_KEY'>;

/** The site key pages render with, or null when bot checks are off. */
export function turnstileSiteKey(env: Partial<TurnstileEnv>): string | null {
    return (
        (env.TURNSTILE_SITE_KEY?.trim() && env.TURNSTILE_SECRET_KEY?.trim() && env.TURNSTILE_SITE_KEY.trim()) || null
    );
}

/** The secret the server checks with, or null when bot checks are off. */
function turnstileSecret(env: Partial<TurnstileEnv>): string | null {
    return turnstileSiteKey(env) ? env.TURNSTILE_SECRET_KEY!.trim() : null;
}

export interface HumanCheck {
    /** The form's action, the one its widget renders with. */
    action: string;
    /** `refuse` where the form mails an address or creates something; `allow` behind another gate. */
    unreachable: RequireHumanOptions['unreachable'];
}

/** The 403 (or 503) when a browser submission did not pass Turnstile, else null. */
export function requireHuman(
    request: Request,
    env: Partial<TurnstileEnv>,
    check: HumanCheck,
): Promise<Response | null> {
    return checkHuman(request, { secret: turnstileSecret(env), ...check });
}

export interface PublicFormGuard extends HumanCheck {
    /** The rate limit key, usually the form and the client IP. */
    key: string;
}

/**
 * The gate for an anonymous form: the rate limit first (cheap, and a flood never reaches
 * Cloudflare's siteverify), then Turnstile. Null means go ahead.
 */
export async function guardPublicForm(
    request: Request,
    env: CloudflareEnv,
    guard: PublicFormGuard,
): Promise<Response | null> {
    const limited = await enforceRateLimit(request, env, guard.key);
    if (limited) return limited;
    return requireHuman(request, env, guard);
}

/** The `<meta>` the widget reads its site key from, added to every HTML document when checks are on. */
export function turnstileMetaTag(env: Partial<TurnstileEnv>): string | null {
    const siteKey = turnstileSiteKey(env);
    // Site keys are letters, digits, `_` and `-`; anything else is a misconfiguration, not markup.
    if (!siteKey || !/^[A-Za-z0-9_-]+$/.test(siteKey)) return null;
    return `<meta name="turnstile-site-key" content="${siteKey}">`;
}

/** Add the site key meta to an HTML response. Untouched when checks are off. */
export async function injectTurnstileSiteKey(response: Response, env: Partial<TurnstileEnv>): Promise<Response> {
    const tag = turnstileMetaTag(env);
    if (!tag) return response;
    const html = await response.text();
    // The body is no longer the asset's, so neither are its validators.
    const headers = new Headers(response.headers);
    headers.delete('ETag');
    headers.delete('Last-Modified');
    headers.set('Cache-Control', 'no-store');
    return new Response(
        html.replace('</head>', () => `    ${tag}\n    </head>`),
        {
            status: response.status,
            statusText: response.statusText,
            headers,
        },
    );
}
