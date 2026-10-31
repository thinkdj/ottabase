// The Turnstile demo (/demo/cloudflare/turnstile): checks the widget's token the way every public
// form does and answers the verdict, so the page can show it. Anyone may try it (it is what a
// stranger sees on a form), rate limited per IP like the forms.
import { TURNSTILE_HEADER, TURNSTILE_TEST_KEYS, verifyTurnstile } from '@ottabase/cf/turnstile';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { enforceRateLimit } from '../lib/rate-limiting';
import { turnstileSiteKey } from '../lib/turnstile';
import { getClientIpAddress, readJson } from '../lib/utils';
import type { ApiRouteContext } from './router';

/** The demo widget's action. */
export const TURNSTILE_DEMO_ACTION = 'demo';

/** Which secret checks the token: the app's own, or the test secret paired with a test site key. */
const SECRETS = {
    pass: TURNSTILE_TEST_KEYS.secret.pass,
    block: TURNSTILE_TEST_KEYS.secret.fail,
    interactive: TURNSTILE_TEST_KEYS.secret.pass,
} as const;

export type TurnstileDemoMode = 'app' | keyof typeof SECRETS;

export async function handleTurnstileDemo(context: ApiRouteContext): Promise<Response> {
    const { request, env } = context;
    const limited = await enforceRateLimit(request, env, `demo:turnstile:${getClientIpAddress(request)}`);
    if (limited) return limited;

    const { mode } = await readJson<{ mode?: unknown }>(request);
    let secret: string;
    if (mode === 'app') {
        if (!turnstileSiteKey(env)) {
            return errorResponse('This deployment has no Turnstile keys', 400, { code: 'TURNSTILE_NOT_CONFIGURED' });
        }
        secret = env.TURNSTILE_SECRET_KEY.trim();
    } else if (mode === 'pass' || mode === 'block' || mode === 'interactive') {
        secret = SECRETS[mode];
    } else {
        return errorResponse('Unknown mode', 400, { code: 'VALIDATION_ERROR' });
    }

    const verdict = await verifyTurnstile({
        secret,
        token: request.headers.get(TURNSTILE_HEADER),
        action: TURNSTILE_DEMO_ACTION,
        hostname: new URL(request.url).hostname,
        remoteip: request.headers.get('CF-Connecting-IP') ?? undefined,
    });
    return jsonResponse({ data: { mode, ...verdict } });
}
