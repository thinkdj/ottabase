// ====================================================================
// otta-web — /api/ai/*
// --------------------------------------------------------------------
// Two kinds of route:
//
//  1. CREDENTIAL MANAGEMENT — delegated wholesale to the package's route
//     factory. Not a branch in the shared CRUD dispatcher: `ai_provider_credentials`
//     is deliberately absent from GENERIC_CRUD_ALLOWLIST, and the factory is what
//     carries the tenancy stamping, the authorize hook and the filter/sort deny-list.
//
//  2. INFERENCE — the app's own front door. `resolve(context, taskKey)` and the
//     server-side gate; the call site names identity and a task key, nothing else.
// ====================================================================

import { AI_ERROR_HTTP_STATUS, AI_ERROR_MESSAGES, isDynamicModelRef } from '@ottabase/ottaai';
import type { SecurityContext } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { AI_TASKS, getAiProvisioning, type AiInstance } from '../lib/ai';
import type { ApiRouteContext } from './router';

/** 501 when the whole feature is dormant — actionable copy, never a 500 and never a crash. */
function notConfigured(): Response {
    return errorResponse(
        'AI is not configured on this deployment. Set AI_CREDENTIAL_SECRET and enable the ottaai package.',
        501,
        { code: 'NOT_CONFIGURED', hint: 'See packages/ottaai/README.md — Setup.' },
    );
}

async function withInstance(
    context: ApiRouteContext,
    run: (instance: AiInstance, security: SecurityContext) => Promise<Response>,
    waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response> {
    const resolved = await getAiProvisioning({
        request: context.request,
        env: context.env,
        // `ApiRouteContext` deliberately drops `ExecutionContext`, so the inference route is
        // registered with the raw ottarouter `Ctx` and threads `c.ctx.waitUntil` through
        // here. Without it, health writes and attribution records are issued after the
        // response with nothing keeping the request alive — SILENT DATA LOSS, which is
        // precisely the failure the `defer` seam exists to prevent.
        waitUntil,
    });
    if (!resolved) return notConfigured();
    return run(resolved.ai, resolved.security);
}

/**
 * Every INFERENCE route must gate on an authenticated session.
 *
 * THE CREDENTIAL ROUTES ALREADY DO — the package's route factory 401s when
 * `contextFromRequest` returns null. The inference route does NOT go through that factory,
 * so the check has to be here, and its absence is not a lesser bug: `getSecurityContext`
 * only membership-verifies an org id when a `userId` is present, so for an ANONYMOUS
 * request the client-supplied `x-org-id` header survives verbatim into the branded context
 * — and the resolver deliberately bypasses RLS. That is the exact confused-deputy failure
 * the package documents: set one header, run on another tenant's key and bill.
 */
function requireSession(security: SecurityContext): Response | null {
    if (security.userId) return null;
    return errorResponse('Authentication required', 401, { code: 'UNAUTHENTICATED' });
}

// ---------------------------------------------------------------------------
// Credential management — one delegation each
// ---------------------------------------------------------------------------

export const handleAiCredentialsList = (c: ApiRouteContext) => withInstance(c, (ai) => ai.handlers.list(c.request));
export const handleAiCredentialsCreate = (c: ApiRouteContext) => withInstance(c, (ai) => ai.handlers.create(c.request));
export const handleAiCredentialsUpdate = (c: ApiRouteContext, id: string) =>
    withInstance(c, (ai) => ai.handlers.update(c.request, id));
export const handleAiCredentialsDelete = (c: ApiRouteContext, id: string) =>
    withInstance(c, (ai) => ai.handlers.remove(c.request, id));
export const handleAiCredentialsActivate = (c: ApiRouteContext, id: string) =>
    withInstance(c, (ai) => ai.handlers.activate(c.request, id));
export const handleAiCredentialsTest = (c: ApiRouteContext) => withInstance(c, (ai) => ai.handlers.test(c.request));
export const handleAiStatus = (c: ApiRouteContext) => withInstance(c, (ai) => ai.handlers.status(c.request));
export const handleAiProviders = (c: ApiRouteContext) => withInstance(c, (ai) => ai.handlers.providers(c.request));
export const handleAiExplain = (c: ApiRouteContext) => withInstance(c, (ai) => ai.handlers.explain(c.request));

// ---------------------------------------------------------------------------
// Inference — the app's front door
// ---------------------------------------------------------------------------

/**
 * The request body, typed as `unknown` per field ON PURPOSE.
 *
 * `JSON.parse` returns `any`, and declaring `prompt?: string` here is a LIE the compiler then
 * happily enforces downstream — which is how `body.system` ended up used truthily and passed
 * through to a provider payload without ever being checked for being a string. Typing the
 * fields `unknown` makes the validators below mandatory rather than optional.
 */
interface CompleteBody {
    task?: unknown;
    prompt?: unknown;
    system?: unknown;
    model?: unknown;
}

const KNOWN_TASKS = new Set<string>(Object.values(AI_TASKS));

/**
 * PER-TASK INPUT BUDGET, in characters.
 *
 * An authenticated user could otherwise post a multi-megabyte prompt: the worker serialises
 * it, the gateway forwards it, and the provider either bills for it or 413s after the
 * round trip. Either way the tenant (or the operator, on the platform floor) pays for a
 * request that was never going to be useful, and the failure arrives late and looks upstream.
 *
 * CHARACTERS, NOT TOKENS, deliberately: a token count needs a per-model tokenizer that this
 * route has no business shipping, and the point is a coarse sanity ceiling rather than an
 * accurate budget. Roughly 4 chars/token, so `assist` ≈ 4k tokens and `extract` ≈ 32k.
 *
 * PER TASK because the tasks genuinely differ — document extraction is expected to carry a
 * long body, a chat assist is not, and one global limit would be wrong for both.
 */
const TASK_INPUT_LIMITS: Record<string, { prompt: number; system: number }> = {
    [AI_TASKS.assist]: { prompt: 16_000, system: 4_000 },
    [AI_TASKS.summarize]: { prompt: 64_000, system: 4_000 },
    [AI_TASKS.extract]: { prompt: 128_000, system: 4_000 },
};

/** Applied to any task without its own entry, so a NEW task is never accidentally unbounded. */
const DEFAULT_INPUT_LIMIT = { prompt: 16_000, system: 4_000 } as const;

/**
 * Generous ceiling on the raw body, checked before `request.json()`.
 *
 * AN OPTIMISATION, NOT A SECURITY BOUNDARY — say it plainly, because it is easy to mistake
 * for one. `Content-Length` is absent on a chunked body and is client-supplied either way, so
 * this only short-circuits the honest oversized request. The real bound is the per-task
 * character limits above, which run on the PARSED values and cannot be lied about.
 *
 * Sized well above the largest task budget (`extract`, 128k chars) plus JSON overhead, so it
 * never rejects a request the character limits would have accepted.
 */
const MAX_BODY_BYTES = 512 * 1024;

/**
 * Validate an untrusted string field from the request body.
 *
 * `typeof` IS LOAD-BEARING, not defensive noise. `body.system` was consumed truthily, so
 * `{"system": {"role": "…"}}` produced a message whose `content` was an OBJECT — which then
 * serialised into the provider payload as a nested object. Providers respond to that with a
 * 400 whose message is about their schema, so it debugs as a transport bug rather than as
 * unvalidated input. The same applies to arrays and numbers.
 */
function validateText(
    value: unknown,
    field: string,
    max: number,
    required: boolean,
): { ok: true; value: string } | { ok: false; message: string } {
    if (value === undefined || value === null || value === '') {
        if (required) return { ok: false, message: `A ${field} is required` };
        return { ok: true, value: '' };
    }
    if (typeof value !== 'string') return { ok: false, message: `${field} must be a string` };
    const trimmed = value.trim();
    if (required && !trimmed) return { ok: false, message: `A ${field} is required` };
    if (trimmed.length > max) {
        return { ok: false, message: `${field} is too long (${trimmed.length} characters; limit is ${max})` };
    }
    return { ok: true, value: trimmed };
}

/**
 * A per-call model override is a REQUEST-CONTROLLED value that beats every other rung of
 * the model chain, so it is validated here rather than trusted.
 *
 * The package refuses a `dynamic/<route>` ref from a per-call override (operator
 * namespace), but this route additionally refuses anything that is not a plain model
 * reference: a raw path segment would otherwise be interpolated into the gateway URL, and
 * `..` in it retargets the whole request while still carrying the operator's gateway token.
 */
const SAFE_MODEL_REF = /^[A-Za-z0-9@][A-Za-z0-9._:@-]*(\/[A-Za-z0-9._:@-]+)*$/;

function validateModelOverride(model: unknown): { ok: true; model?: string } | { ok: false; message: string } {
    if (model === undefined || model === null || model === '') return { ok: true };
    if (typeof model !== 'string') return { ok: false, message: 'model must be a string' };
    const trimmed = model.trim();
    if (trimmed.length > 200) return { ok: false, message: 'model reference is too long' };
    if (trimmed.includes('..')) return { ok: false, message: 'model reference may not contain ".."' };
    if (!SAFE_MODEL_REF.test(trimmed)) return { ok: false, message: 'model reference contains invalid characters' };
    // The resolver refuses a dynamic ref by THROWING (programmer error at a call site).
    // Reaching it from a request body would surface as a 500; a request-shaped refusal is a
    // 400, so it is caught here first.
    if (isDynamicModelRef(trimmed)) {
        return { ok: false, message: 'dynamic/<route> model references are operator-only' };
    }
    return { ok: true, model: trimmed };
}

/**
 * POST /api/ai/complete — run a declared task.
 *
 * The call site passes IDENTITY (implicit, from the session) and a TASK KEY. It does not
 * choose a provider, a key, or a model — that is the whole promise: an operator flips
 * provisioning behaviour without touching this handler.
 */
export async function handleAiComplete(
    context: ApiRouteContext,
    waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response> {
    return withInstance(
        context,
        async (ai, security) => {
            const unauthenticated = requireSession(security);
            if (unauthenticated) return unauthenticated;

            // Cheap fast path only — see MAX_BODY_BYTES. A missing or lying header simply
            // falls through to the parse and then to the per-task character limits.
            const declaredLength = Number(context.request.headers.get('content-length') ?? '0');
            if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
                return errorResponse('Request body is too large', 413, { code: 'PAYLOAD_TOO_LARGE' });
            }

            let body: CompleteBody;
            try {
                body = (await context.request.json()) as CompleteBody;
            } catch {
                return errorResponse('Invalid JSON body', 400, { code: 'INVALID_JSON' });
            }

            const taskKey = body.task === undefined || body.task === null ? AI_TASKS.assist : body.task;
            if (typeof taskKey !== 'string' || !KNOWN_TASKS.has(taskKey)) {
                return errorResponse(`Unknown AI task "${String(taskKey)}"`, 400, { code: 'VALIDATION_ERROR' });
            }

            // VALIDATED BEFORE RESOLUTION, so an oversized or malformed payload costs a
            // string length check rather than a candidate fan-out, an envelope decrypt and an
            // upstream round trip.
            const limits = TASK_INPUT_LIMITS[taskKey] ?? DEFAULT_INPUT_LIMIT;
            const promptField = validateText(body.prompt, 'prompt', limits.prompt, true);
            if (!promptField.ok) return errorResponse(promptField.message, 400, { code: 'VALIDATION_ERROR' });
            const systemField = validateText(body.system, 'system', limits.system, false);
            if (!systemField.ok) return errorResponse(systemField.message, 400, { code: 'VALIDATION_ERROR' });
            const prompt = promptField.value;
            const system = systemField.value;

            const modelOverride = validateModelOverride(body.model);
            if (!modelOverride.ok) {
                return errorResponse(modelOverride.message, 400, { code: 'VALIDATION_ERROR' });
            }

            const aiContext = ai.contextFrom({ authenticated: true });

            // THE SERVER-SIDE GATE AND THE CLIENT, FROM ONE RESOLUTION.
            //
            // The gate is implemented by the SAME resolver as the runtime path, so guard and
            // runtime cannot drift — a gate enforced only in the browser stops nobody with a
            // fetch call, and the routes behind it would resolve happily to the platform key.
            //
            // `requireByok(...)` then `resolve(...)` reads better and does the whole job
            // twice: two candidate fan-outs and two envelope decryptions per inference, on the
            // hot path. It can also disagree with itself if a credential changes between the
            // two calls, which surfaces as an allowed gate followed by NOT_CONFIGURED.
            const { gate, resolution } = await ai.resolveWithGate(aiContext, taskKey, {
                model: modelOverride.model,
            });
            if (!gate.allowed) {
                return errorResponse(AI_ERROR_MESSAGES.BYOK_REQUIRED, AI_ERROR_HTTP_STATUS.BYOK_REQUIRED, {
                    code: gate.code,
                    hint: gate.reason,
                });
            }

            if (!resolution.client) {
                // ABSENCE OF A CLIENT IS THE SIGNAL — the resolver never throws for this.
                const code = resolution.reason === 'CREDENTIAL_UNREADABLE' ? 'CREDENTIAL_UNREADABLE' : 'NOT_CONFIGURED';
                return errorResponse(AI_ERROR_MESSAGES[code], AI_ERROR_HTTP_STATUS[code], {
                    code,
                    hint: resolution.tenantReason ?? resolution.reason,
                });
            }

            const result = await resolution.client.complete({
                messages: [
                    ...(system ? [{ role: 'system' as const, content: system }] : []),
                    { role: 'user' as const, content: prompt },
                ],
                maxTokens: 1024,
            });

            if (!result.ok) {
                return errorResponse(result.message, AI_ERROR_HTTP_STATUS[result.code], { code: result.code });
            }

            return jsonResponse({
                text: result.result.text,
                // The REDACTED projection only. The merged transport config — the object that
                // carries the tenant's provider key — never crosses this boundary.
                source: resolution.source,
                provider: resolution.configSummary.provider,
                model: resolution.configSummary.model,
                usage: result.result.tokens,
            });
        },
        waitUntil,
    );
}
