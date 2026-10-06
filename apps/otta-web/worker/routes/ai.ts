// ====================================================================
// otta-web, /api/ai/*
// --------------------------------------------------------------------
// Two kinds of route:
//
//  1. CREDENTIAL MANAGEMENT: delegated wholesale to the package's route
//     factory. Not a branch in the shared CRUD dispatcher: `ai_provider_credentials`
//     is deliberately absent from GENERIC_CRUD_ALLOWLIST, and the factory is what
//     carries the tenancy stamping, the authorize hook and the filter/sort deny-list.
//
//  2. INFERENCE: the app's own front door. `resolve(context, taskKey)` and the
//     server-side gate; the call site names identity and a task key, nothing else.
// ====================================================================

import {
    AI_CONTENT_LIMITS,
    AI_ERROR_HTTP_STATUS,
    AI_ERROR_MESSAGES,
    AI_IMAGE_MIME_TYPES,
    base64DecodedBytes,
    type AiContentPart,
    type AiImageMimeType,
    type AiMessage,
} from '@ottabase/ottaai';
import type { SecurityContext } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { AI_TASK_POLICIES, AI_TASKS, getAiProvisioning, type AiInstance } from '../lib/ai';
import { createRequestThrottle } from '../lib/ai-rate-limit';
import type { ApiRouteContext } from './router';

/** 501 when the whole feature is dormant, actionable copy, never a 500 and never a crash. */
function notConfigured(): Response {
    return errorResponse(
        'AI is not configured on this deployment. Enable the ottaai package, configure a Cloudflare AI Gateway route, and set AI_CREDENTIAL_SECRET only when BYOK is enabled.',
        501,
        { code: 'NOT_CONFIGURED', hint: 'See packages/ottaai/README.md, Setup.' },
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
        // response with nothing keeping the request alive, SILENT DATA LOSS, which is
        // precisely the failure the `defer` seam exists to prevent.
        waitUntil,
    });
    if (!resolved) return notConfigured();
    return run(resolved.ai, resolved.security);
}

/** Tenant credential endpoints are absent in platform-only mode, while status/inference remain available. */
async function withByokInstance(
    context: ApiRouteContext,
    run: (instance: AiInstance, security: SecurityContext) => Promise<Response>,
): Promise<Response> {
    return withInstance(context, (ai, security) => {
        if (!ai.byokEnabled) {
            return Promise.resolve(
                errorResponse('Tenant AI credentials are disabled on this deployment.', 404, { code: 'NOT_FOUND' }),
            );
        }
        return run(ai, security);
    });
}

/**
 * Every INFERENCE route must gate on an authenticated session.
 *
 * THE CREDENTIAL ROUTES ALREADY DO, the package's route factory 401s when
 * `contextFromRequest` returns null. The inference route does NOT go through that factory,
 * so the check has to be here, and its absence is not a lesser bug: `getSecurityContext`
 * only membership-verifies an org id when a `userId` is present, so for an ANONYMOUS
 * request the client-supplied `x-org-id` header survives verbatim into the branded context
 *, and the resolver deliberately bypasses RLS. That is the exact confused-deputy failure
 * the package documents: set one header, run on another tenant's key and bill.
 */
function requireSession(security: SecurityContext): Response | null {
    if (security.userId) return null;
    return errorResponse('Authentication required', 401, { code: 'UNAUTHENTICATED' });
}

// ---------------------------------------------------------------------------
// Credential management, one delegation each
// ---------------------------------------------------------------------------

export const handleAiCredentialsList = (c: ApiRouteContext) => withByokInstance(c, (ai) => ai.handlers.list(c.request));
export const handleAiCredentialsCreate = (c: ApiRouteContext) =>
    withByokInstance(c, (ai) => ai.handlers.create(c.request));
export const handleAiCredentialsUpdate = (c: ApiRouteContext, id: string) =>
    withByokInstance(c, (ai) => ai.handlers.update(c.request, id));
export const handleAiCredentialsDelete = (c: ApiRouteContext, id: string) =>
    withByokInstance(c, (ai) => ai.handlers.remove(c.request, id));
export const handleAiCredentialsActivate = (c: ApiRouteContext, id: string) =>
    withByokInstance(c, (ai) => ai.handlers.activate(c.request, id));
export const handleAiCredentialsTest = (c: ApiRouteContext) => withByokInstance(c, (ai) => ai.handlers.test(c.request));
export const handleAiStatus = (c: ApiRouteContext) => withInstance(c, (ai) => ai.handlers.status(c.request));
export const handleAiProviders = (c: ApiRouteContext) => withByokInstance(c, (ai) => ai.handlers.providers(c.request));
export const handleAiExplain = (c: ApiRouteContext) => withInstance(c, (ai) => ai.handlers.explain(c.request));

// ---------------------------------------------------------------------------
// Inference, the app's front door
// ---------------------------------------------------------------------------
//
// TWO CHAT ROUTES, SPLIT BY BODY SIZE, NOT BY FEATURE:
//
//   POST /api/ai/complete: text tasks.  512 KB body cap.
//   POST /api/ai/vision: image tasks. ~12 MB body cap, plus a per-user throttle that runs
//                           BEFORE the body is read.
//
// The task is only known after the body is parsed, so one route accepting images would have
// to accept a multi-megabyte body for EVERY task, and let any signed-in user make the Worker
// parse one, unthrottled (the inference limiter is the package's quota hook, which runs after
// resolution). The URL decides the size before a byte is read.

/**
 * The request body, typed as `unknown` per field ON PURPOSE.
 *
 * `JSON.parse` returns `any`, and declaring `prompt?: string` here is a LIE the compiler then
 * happily enforces downstream, which is how `body.system` ended up used truthily and passed
 * through to a provider payload without ever being checked for being a string. Typing the
 * fields `unknown` makes the validators below mandatory rather than optional.
 */
interface CompleteBody {
    task?: unknown;
    prompt?: unknown;
    system?: unknown;
    /** `/vision` only: `[{ mimeType, data }]`, base64 with no `data:` prefix. */
    images?: unknown;
    /** Rejected when present: provider/model choice is server-owned task policy. */
    model?: unknown;
}

/** A deliberately small, text-only embedding payload. */
interface EmbedBody {
    input?: unknown;
    dimensions?: unknown;
}

const KNOWN_TASKS = new Set<string>(Object.values(AI_TASKS));

/**
 * What a task accepts and returns is READ FROM ITS DECLARATION, never from the request body.
 * A task declaring `vision` is served by `/vision`; a task declaring `json` always answers
 * with a JSON object. The browser cannot ask a text task to read an image or change a task's
 * output format, for the same reason it cannot choose the model.
 */
function taskAccepts(taskKey: string, capability: 'vision' | 'json'): boolean {
    return AI_TASK_POLICIES.find((task) => task.key === taskKey)?.requiredCapabilities?.includes(capability) ?? false;
}

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
 * PER TASK because the tasks genuinely differ, document extraction is expected to carry a
 * long body, a chat assist is not, and one global limit would be wrong for both. The OUTPUT
 * budget is not here: it is the task policy's `maxTokens`, applied by the package.
 */
const TASK_INPUT_LIMITS: Record<string, { prompt: number; system: number }> = {
    [AI_TASKS.assist]: { prompt: 16_000, system: 4_000 },
    [AI_TASKS.summarize]: { prompt: 64_000, system: 4_000 },
    [AI_TASKS.extract]: { prompt: 128_000, system: 4_000 },
    [AI_TASKS.scan]: { prompt: 4_000, system: 4_000 },
};

/** Applied to any task without its own entry, so a NEW task is never accidentally unbounded. */
const DEFAULT_INPUT_LIMIT = { prompt: 16_000, system: 4_000 } as const;

/** Bound both individual text values and the whole batch before the resolver runs. */
const EMBEDDING_INPUT_LIMITS = { items: 16, itemCharacters: 16_000, totalCharacters: 64_000 } as const;

/** `text-embedding-3-small`, the task-pinned model, supports up to 1,536 dimensions. */
const MAX_EMBEDDING_DIMENSIONS = 1_536;

/** Body cap for the text routes: the largest text budget (`extract`, 128k chars) plus JSON overhead. */
const TEXT_BODY_BYTES = 512 * 1024;

/**
 * This deployment's image budget: `features.ottaai.images`, clamped to the package's provider
 * floor so a generous config can never build a request a selectable provider rejects for size.
 */
function imageBudget(env: CloudflareEnv) {
    const images = getOttabaseConfig(env as unknown as Record<string, unknown>).features.ottaai.images;
    const maxBytes = Math.min(images.maxBytes, AI_CONTENT_LIMITS.imageBytes);
    const maxTotalBytes = Math.min(images.maxTotalBytes, AI_CONTENT_LIMITS.totalImageBytes);
    return {
        maxCount: Math.min(images.maxCount, AI_CONTENT_LIMITS.images),
        maxBytes,
        maxTotalBytes,
        perUserPerMinute: images.perUserPerMinute,
        // base64 is 4/3 of the decoded size; the text budget rides on top.
        bodyBytes: Math.ceil((maxTotalBytes * 4) / 3) + TEXT_BODY_BYTES,
    };
}

/**
 * Read and parse a JSON body with a HARD byte cap.
 *
 * A REAL BOUNDARY, unlike a `Content-Length` check alone: the header is client-supplied and
 * absent on a chunked body, so this counts the bytes actually read and stops reading the
 * moment the cap is passed. `Content-Length` remains as the fast path for an honest client.
 */
async function readJsonBody(
    request: Request,
    maxBytes: number,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
    const tooLarge = () => ({
        ok: false as const,
        response: errorResponse('Request body is too large', 413, { code: 'PAYLOAD_TOO_LARGE' }),
    });
    const invalid = () => ({
        ok: false as const,
        response: errorResponse('Invalid JSON body', 400, { code: 'INVALID_JSON' }),
    });

    const declared = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > maxBytes) return tooLarge();
    if (!request.body) return invalid();

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => {});
            return tooLarge();
        }
        chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
            ? { ok: true, body: parsed as Record<string, unknown> }
            : invalid();
    } catch {
        return invalid();
    }
}

/**
 * Validate an untrusted string field from the request body.
 *
 * `typeof` IS LOAD-BEARING, not defensive noise. `body.system` was consumed truthily, so
 * `{"system": {"role": "…"}}` produced a message whose `content` was an OBJECT, which then
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
 * Validate untrusted `images` into content parts, CONSTANT-TIME CHECKS ONLY.
 *
 * Count, type, mime and decoded size are all O(1) per image, so a bad upload is refused before
 * resolution for the price of a few comparisons. The full base64 scan is NOT repeated here:
 * the package's `validateCallContent` runs it exactly once, at call time, and a malformed
 * payload comes back as `VALIDATION` from there. Scanning ~10 MB of base64 twice per request
 * was measurable Worker CPU for no extra safety.
 */
function validateImages(
    images: unknown,
    budget: ReturnType<typeof imageBudget>,
): { ok: true; parts: AiContentPart[] } | { ok: false; message: string } {
    if (!Array.isArray(images) || images.length === 0) {
        return { ok: false, message: 'images must be a non-empty array of { mimeType, data }' };
    }
    if (images.length > budget.maxCount) {
        return { ok: false, message: `at most ${budget.maxCount} images per request` };
    }
    const parts: AiContentPart[] = [];
    let total = 0;
    for (const image of images) {
        const { mimeType, data } = (image ?? {}) as { mimeType?: unknown; data?: unknown };
        if (typeof mimeType !== 'string' || !(AI_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
            return { ok: false, message: `image mimeType must be one of ${AI_IMAGE_MIME_TYPES.join(', ')}` };
        }
        if (typeof data !== 'string' || data.length === 0 || data.startsWith('data:')) {
            return { ok: false, message: 'image data must be base64 with no "data:" prefix' };
        }
        const bytes = base64DecodedBytes(data);
        if (bytes > budget.maxBytes) {
            return { ok: false, message: `each image is limited to ${formatMegabytes(budget.maxBytes)}` };
        }
        total += bytes;
        if (total > budget.maxTotalBytes) {
            return { ok: false, message: `images are limited to ${formatMegabytes(budget.maxTotalBytes)} in total` };
        }
        parts.push({ type: 'image', mimeType: mimeType as AiImageMimeType, data });
    }
    return { ok: true, parts };
}

function formatMegabytes(bytes: number): string {
    return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function validateEmbeddingInput(
    input: unknown,
): { ok: true; input: string | string[] } | { ok: false; message: string } {
    const values = Array.isArray(input) ? input : [input];
    if (values.length === 0 || values.length > EMBEDDING_INPUT_LIMITS.items) {
        return {
            ok: false,
            message: `input must contain between 1 and ${EMBEDDING_INPUT_LIMITS.items} text values`,
        };
    }

    let totalCharacters = 0;
    const validated: string[] = [];
    for (const value of values) {
        if (typeof value !== 'string') return { ok: false, message: 'every input value must be a string' };
        const text = value.trim();
        if (!text) return { ok: false, message: 'every input value must contain text' };
        if (text.length > EMBEDDING_INPUT_LIMITS.itemCharacters) {
            return {
                ok: false,
                message: `each input value is limited to ${EMBEDDING_INPUT_LIMITS.itemCharacters} characters`,
            };
        }
        totalCharacters += text.length;
        if (totalCharacters > EMBEDDING_INPUT_LIMITS.totalCharacters) {
            return {
                ok: false,
                message: `embedding input is limited to ${EMBEDDING_INPUT_LIMITS.totalCharacters} characters in total`,
            };
        }
        validated.push(text);
    }

    return { ok: true, input: Array.isArray(input) ? validated : validated[0]! };
}

function validateEmbeddingDimensions(
    dimensions: unknown,
): { ok: true; dimensions?: number } | { ok: false; message: string } {
    if (dimensions === undefined || dimensions === null || dimensions === '') return { ok: true };
    if (!Number.isInteger(dimensions) || typeof dimensions !== 'number') {
        return { ok: false, message: 'dimensions must be a whole number' };
    }
    if (dimensions < 1 || dimensions > MAX_EMBEDDING_DIMENSIONS) {
        return { ok: false, message: `dimensions must be between 1 and ${MAX_EMBEDDING_DIMENSIONS}` };
    }
    return { ok: true, dimensions };
}

/** The task key, prompt and system instruction common to both chat routes, validated. */
function parseChatFields(
    body: CompleteBody,
    defaultTask: string,
): { ok: true; taskKey: string; prompt: string; system: string } | { ok: false; response: Response } {
    const fail = (message: string) => ({
        ok: false as const,
        response: errorResponse(message, 400, { code: 'VALIDATION_ERROR' }),
    });
    const taskKey = body.task === undefined || body.task === null ? defaultTask : body.task;
    if (typeof taskKey !== 'string' || !KNOWN_TASKS.has(taskKey)) return fail(`Unknown AI task "${String(taskKey)}"`);
    if (body.model !== undefined) return fail('model is controlled by the declared AI task');

    // VALIDATED BEFORE RESOLUTION, so an oversized or malformed payload costs a string length
    // check rather than a candidate fan-out, an envelope decrypt and an upstream round trip.
    const limits = TASK_INPUT_LIMITS[taskKey] ?? DEFAULT_INPUT_LIMIT;
    const prompt = validateText(body.prompt, 'prompt', limits.prompt, true);
    if (!prompt.ok) return fail(prompt.message);
    const system = validateText(body.system, 'system', limits.system, false);
    if (!system.ok) return fail(system.message);
    return { ok: true, taskKey, prompt: prompt.value, system: system.value };
}

/**
 * Resolve, gate and run one chat task, shared by `/complete` and `/vision`.
 *
 * THE SERVER-SIDE GATE AND THE CLIENT, FROM ONE RESOLUTION. The gate is implemented by the
 * SAME resolver as the runtime path, so guard and runtime cannot drift. `requireByok(...)`
 * then `resolve(...)` reads better and does the whole job twice, two candidate fan-outs and
 * two envelope decryptions per inference, on the hot path, and can disagree with itself if
 * a credential changes between the two calls.
 */
async function runChatTask(ai: AiInstance, taskKey: string, messages: AiMessage[]): Promise<Response> {
    const json = taskAccepts(taskKey, 'json');
    const { gate, resolution } = await ai.resolveWithGate(ai.contextFrom({ authenticated: true }), taskKey);
    if (!gate.allowed) {
        return errorResponse(AI_ERROR_MESSAGES.BYOK_REQUIRED, AI_ERROR_HTTP_STATUS.BYOK_REQUIRED, {
            code: gate.code,
            hint: gate.reason,
        });
    }
    if (!resolution.client) {
        // ABSENCE OF A CLIENT IS THE SIGNAL, the resolver never throws for this.
        const code = resolution.reason === 'CREDENTIAL_UNREADABLE' ? 'CREDENTIAL_UNREADABLE' : 'NOT_CONFIGURED';
        return errorResponse(AI_ERROR_MESSAGES[code], AI_ERROR_HTTP_STATUS[code], {
            code,
            hint: resolution.tenantReason ?? resolution.reason,
        });
    }

    // No `maxTokens` here: the task policy owns the output budget.
    const result = await resolution.client.complete({
        messages,
        ...(json ? { responseFormat: { type: 'json' as const } } : {}),
    });
    if (!result.ok) {
        return errorResponse(result.message, AI_ERROR_HTTP_STATUS[result.code], { code: result.code });
    }

    return jsonResponse({
        text: result.result.text,
        // Present exactly for tasks declaring `json`: the package guarantees it parsed.
        ...(json ? { json: result.result.json } : {}),
        // The REDACTED projection only. The merged transport config, the object that
        // carries the tenant's provider key, never crosses this boundary.
        source: resolution.source,
        provider: resolution.configSummary.provider,
        model: resolution.configSummary.model,
        usage: result.result.tokens,
    });
}

/**
 * POST /api/ai/complete: run a declared TEXT task.
 *
 * The call site passes IDENTITY (implicit, from the session) and a TASK KEY. It does not
 * choose a provider, a key, or a model, that is the whole promise: an operator flips
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

            const read = await readJsonBody(context.request, TEXT_BODY_BYTES);
            if (!read.ok) return read.response;
            const body = read.body as CompleteBody;
            if (body.images !== undefined) {
                return errorResponse('Images are accepted by POST /api/ai/vision, not /complete', 400, {
                    code: 'VALIDATION_ERROR',
                });
            }

            const fields = parseChatFields(body, AI_TASKS.assist);
            if (!fields.ok) return fields.response;
            if (taskAccepts(fields.taskKey, 'vision')) {
                return errorResponse(`The "${fields.taskKey}" task reads images, use POST /api/ai/vision`, 400, {
                    code: 'VALIDATION_ERROR',
                });
            }

            return runChatTask(ai, fields.taskKey, [
                ...(fields.system ? [{ role: 'system' as const, content: fields.system }] : []),
                { role: 'user' as const, content: fields.prompt },
            ]);
        },
        waitUntil,
    );
}

/**
 * POST /api/ai/vision: run a declared task that reads IMAGES (default `scan`).
 *
 * Body: `{ task?, prompt, system?, images: [{ mimeType, data }] }`. The per-user throttle runs
 * before a byte of the (up to ~12 MB) body is read; the image budget is `features.ottaai.images`.
 */
export async function handleAiVision(
    context: ApiRouteContext,
    waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response> {
    return withInstance(
        context,
        async (ai, security) => {
            const unauthenticated = requireSession(security);
            if (unauthenticated) return unauthenticated;

            const budget = imageBudget(context.env);
            const config = getOttabaseConfig(context.env as unknown as Record<string, unknown>);
            const allowed = await createRequestThrottle({
                store: context.env.OBCF_KV ?? null,
                appId: config.appId,
                name: 'vision',
                perMinute: budget.perUserPerMinute,
            })(security.userId!);
            if (!allowed) {
                return errorResponse('Too many image requests. Try again in a minute.', 429, {
                    code: 'RATE_LIMITED',
                });
            }

            const read = await readJsonBody(context.request, budget.bodyBytes);
            if (!read.ok) return read.response;
            const body = read.body as CompleteBody;

            const fields = parseChatFields(body, AI_TASKS.scan);
            if (!fields.ok) return fields.response;
            if (!taskAccepts(fields.taskKey, 'vision')) {
                return errorResponse(`The "${fields.taskKey}" task does not read images`, 400, {
                    code: 'VALIDATION_ERROR',
                });
            }
            const images = validateImages(body.images, budget);
            if (!images.ok) return errorResponse(images.message, 400, { code: 'VALIDATION_ERROR' });

            return runChatTask(ai, fields.taskKey, [
                ...(fields.system ? [{ role: 'system' as const, content: fields.system }] : []),
                { role: 'user' as const, content: [{ type: 'text' as const, text: fields.prompt }, ...images.parts] },
            ]);
        },
        waitUntil,
    );
}

/**
 * POST /api/ai/embed: produce one vector per text value, in input order.
 *
 * This is intentionally a separate operation from `/complete`: embeddings do not have
 * roles, output tokens or a useful streaming representation. The declared `embed` task
 * owns provider/model selection; the request cannot choose a provider, model or gateway path.
 */
export async function handleAiEmbed(
    context: ApiRouteContext,
    waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response> {
    return withInstance(
        context,
        async (ai, security) => {
            const unauthenticated = requireSession(security);
            if (unauthenticated) return unauthenticated;

            const read = await readJsonBody(context.request, TEXT_BODY_BYTES);
            if (!read.ok) return read.response;
            const body = read.body as EmbedBody;

            const input = validateEmbeddingInput(body.input);
            if (!input.ok) return errorResponse(input.message, 400, { code: 'VALIDATION_ERROR' });
            const dimensions = validateEmbeddingDimensions(body.dimensions);
            if (!dimensions.ok) return errorResponse(dimensions.message, 400, { code: 'VALIDATION_ERROR' });

            const aiContext = ai.contextFrom({ authenticated: true });
            const { gate, resolution } = await ai.resolveWithGate(aiContext, AI_TASKS.embed);
            if (!gate.allowed) {
                return errorResponse(AI_ERROR_MESSAGES.BYOK_REQUIRED, AI_ERROR_HTTP_STATUS.BYOK_REQUIRED, {
                    code: gate.code,
                    hint: gate.reason,
                });
            }
            if (!resolution.client) {
                const code = resolution.reason === 'CREDENTIAL_UNREADABLE' ? 'CREDENTIAL_UNREADABLE' : 'NOT_CONFIGURED';
                return errorResponse(AI_ERROR_MESSAGES[code], AI_ERROR_HTTP_STATUS[code], {
                    code,
                    hint: resolution.tenantReason ?? resolution.reason,
                });
            }

            const result = await resolution.client.embed({ input: input.input, dimensions: dimensions.dimensions });
            if (!result.ok) {
                return errorResponse(result.message, AI_ERROR_HTTP_STATUS[result.code], { code: result.code });
            }

            return jsonResponse({
                vectors: result.result.vectors,
                source: resolution.source,
                provider: result.result.provider,
                model: result.result.model,
                usage: result.result.tokens,
            });
        },
        waitUntil,
    );
}
