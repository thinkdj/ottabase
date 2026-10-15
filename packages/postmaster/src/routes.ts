import { Router } from '@ottabase/ottarouter';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { Suppressions } from './suppression';
import type { Awaitable, ProviderEvent, SuppressionEntry } from './types';
import type { Unsubscribe } from './unsubscribe';
import { parseResendEvent, verifyResendSignature } from './webhooks/resend';
import { parseSesNotification } from './webhooks/ses';

export interface PostmasterHooks<Env> {
    /** A bounce, complaint or delivery arrived from a provider (after suppression was recorded). */
    onProviderEvent?: (event: ProviderEvent, env: Env) => Awaitable<void>;
    /** Someone used an unsubscribe link. */
    onUnsubscribe?: (entry: SuppressionEntry, env: Env) => Awaitable<void>;
}

export interface PostmasterRouterOptions<Env> extends PostmasterHooks<Env> {
    appId: (env: Env) => string;
    suppressions: Suppressions;
    /** Static, or resolved per request from env (secret and public URL live there); `null` answers 503. */
    unsubscribe?: Unsubscribe | ((env: Env) => Unsubscribe | null);
    /** Resend webhook signing secret (`whsec_…`). Without it the Resend route is not mounted. */
    resend?: { webhookSecret: (env: Env) => string | undefined };
    /**
     * SES via SNS. `verify` checks the SNS signature (the host fetches SNS's certificate);
     * without it, protect the route another way (`pathSecret`, Cloudflare Access).
     */
    ses?: {
        pathSecret?: (env: Env) => string | undefined;
        verify?: (body: unknown, request: Request) => Awaitable<boolean>;
    };
    /** Confirm an SNS subscription by visiting its URL. Default `fetch`. */
    fetchImpl?: typeof fetch;
}

/**
 * `POST /resend` and `POST /ses/:secret?` record hard bounces and complaints as `*`
 * suppressions and hand every event to the host. `GET|POST /unsubscribe?token=` records an
 * unsubscribe for the token's list; POST is what one-click clients send.
 */
export function createPostmasterRouter<Env>(options: PostmasterRouterOptions<Env>): Router<Env> {
    const router = new Router<Env>();
    const doFetch = options.fetchImpl ?? fetch;

    async function record(env: Env, event: ProviderEvent): Promise<void> {
        const appId = options.appId(env);
        if (event.type === 'complaint' || (event.type === 'bounce' && event.bounce === 'hard')) {
            for (const address of event.addresses) {
                await options.suppressions.suppress(
                    appId,
                    address,
                    event.type === 'complaint' ? 'complaint' : 'bounce',
                    {
                        source: event.provider,
                    },
                );
            }
        }
        await options.onProviderEvent?.(event, env);
    }

    if (options.resend) {
        router.post('/resend', async (c) => {
            const secret = options.resend!.webhookSecret(c.env);
            if (!secret) return errorResponse('Resend webhooks are not configured', 503, { code: 'NOT_CONFIGURED' });
            const body = await c.req.text();
            if (!(await verifyResendSignature(c.req, body, secret))) {
                return errorResponse('Invalid signature', 401, { code: 'UNAUTHORIZED' });
            }
            let payload: unknown;
            try {
                payload = JSON.parse(body);
            } catch {
                return errorResponse('Body is not JSON', 400, { code: 'VALIDATION_ERROR' });
            }
            const event = parseResendEvent(payload);
            if (!event) return errorResponse('Not a Resend event', 400, { code: 'VALIDATION_ERROR' });
            await record(c.env, event);
            return jsonResponse({ data: { received: event.raw, addresses: event.addresses.length } });
        });
    }

    if (options.ses) {
        const handleSes = async (c: { req: Request; env: Env; params: Record<string, string> }) => {
            const expected = options.ses!.pathSecret?.(c.env);
            if (expected && c.params.secret !== expected) return errorResponse('Not found', 404, { code: 'NOT_FOUND' });
            let payload: unknown;
            try {
                payload = await c.req.json();
            } catch {
                return errorResponse('Body is not JSON', 400, { code: 'VALIDATION_ERROR' });
            }
            if (options.ses!.verify && !(await options.ses!.verify(payload, c.req))) {
                return errorResponse('Invalid signature', 401, { code: 'UNAUTHORIZED' });
            }
            const parsed = parseSesNotification(payload);
            if (parsed.kind === 'subscribe') {
                await doFetch(parsed.subscribeUrl);
                return jsonResponse({ data: { subscribed: parsed.topicArn } });
            }
            if (parsed.kind === 'ignore') return jsonResponse({ data: { ignored: parsed.reason } });
            await record(c.env, parsed.event);
            return jsonResponse({ data: { received: parsed.event.raw, addresses: parsed.event.addresses.length } });
        };
        router.post('/ses', (c) => handleSes({ req: c.req, env: c.env, params: {} }));
        router.post('/ses/:secret', (c) => handleSes({ req: c.req, env: c.env, params: c.params }));
    }

    if (options.unsubscribe) {
        const unsubscribe = async (c: { url: URL; env: Env }) => {
            const minter =
                typeof options.unsubscribe === 'function' ? options.unsubscribe(c.env) : options.unsubscribe!;
            if (!minter) return errorResponse('Unsubscribe links are not configured', 503, { code: 'NOT_CONFIGURED' });
            const claims = await minter.verify(c.url.searchParams.get('token'));
            if (!claims) return errorResponse('This unsubscribe link is not valid', 400, { code: 'VALIDATION_ERROR' });
            if (claims.appId !== options.appId(c.env))
                return errorResponse('This unsubscribe link is not valid', 400, { code: 'VALIDATION_ERROR' });
            const entry = await options.suppressions.suppress(claims.appId, claims.address, 'unsubscribe', {
                list: claims.list,
                source: 'link',
            });
            await options.onUnsubscribe?.(entry, c.env);
            return new Response(`You have been unsubscribed${claims.list === '*' ? '' : ` from ${claims.list}`}.`, {
                status: 200,
                headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
            });
        };
        router.get('/unsubscribe', (c) => unsubscribe({ url: c.url, env: c.env }));
        router.post('/unsubscribe', (c) => unsubscribe({ url: c.url, env: c.env }));
    }

    return router;
}
