// ============================================================
// @ottabase/ottaai/transports — provider wire dialects
// ============================================================
// Request body, response shape and stream frames, per dialect. Split out from the
// gateway adapter because ROUTING AND DIALECT ARE DIFFERENT AXES: Groq shares
// OpenAI's dialect but not its path; Anthropic and Google differ on both.
//
// Every function here is PURE and synchronous, which is what makes the wire
// contract testable without a network or a fake fetch — see
// `__tests__/gateway-wire.test.ts`.
//
// SCOPE: chat completion with text and inline-image input, text or JSON output.
// How each dialect spells an image part and a JSON request is decided HERE; WHETHER
// a route may receive them is the route's `GatewayRouteSupport` (see `./providers`),
// which the gateway adapter checks before this file is ever reached.
// ============================================================

import { messageText, type AiContentPart, type AiMessage, type AiResponseFormat } from '../content';
import type { AiCallOptions, AiCallResult, AiStreamEvent } from '../resolver/transport';
import type { GatewayRouteSupport, GatewayWire } from './providers';

/**
 * Fields the transport owns. `extra` may never set them — see `buildBody`.
 *
 * The output-format fields are here because `responseFormat` owns them: an `extra` that set
 * `response_format` would silently override (or contradict) the JSON tier the caller asked
 * for, and `tools`/`tool_choice` have no representation in the call contract at all. Both
 * output-budget spellings are here because `maxTokens` owns them.
 *
 * Anthropic's `system` is NOT reserved: a caller may pass system BLOCKS through `extra.system`
 * (e.g. with `cache_control` for prompt caching), and the Anthropic builder MERGES them after
 * the system messages instead of letting either side drop the other.
 */
const RESERVED_BODY_KEYS = [
    'model',
    'messages',
    'stream',
    'contents',
    'system_instruction',
    'systemInstruction',
    'response_format',
    'output_config',
    'output_format',
    'tools',
    'tool_choice',
    'max_tokens',
    'max_completion_tokens',
] as const;

/** Gemini output-format keys inside `generationConfig`, owned by `responseFormat` likewise. */
const RESERVED_GENERATION_CONFIG_KEYS = [
    'responseMimeType',
    'response_mime_type',
    'responseSchema',
    'response_schema',
    'responseJsonSchema',
    'response_json_schema',
    '_responseJsonSchema',
    'responseFormat',
    'response_format',
    'maxOutputTokens',
    'max_output_tokens',
];

export interface BuildBodyInput {
    wire: GatewayWire;
    /** Bare model id, or null when the provider carries it in the path (Google, Azure). */
    model: string | null;
    options: AiCallOptions;
    stream: boolean;
    /** What this route accepts — decides HOW a JSON request is spelled. */
    support: GatewayRouteSupport;
    /** Output-budget field on the OpenAI wire. Default `max_tokens`; OpenAI itself uses `max_completion_tokens`. */
    maxTokensField?: 'max_tokens' | 'max_completion_tokens';
}

/**
 * Build the request body for a dialect.
 *
 * `extra` IS SPREAD FIRST, ON PURPOSE. Spreading it last lets a caller overwrite `messages`,
 * `model` or `stream` — and the URL was already chosen from those same values, so the
 * request would be routed for one call and bodied for another. Provider-specific knobs
 * (`top_p`, `stop`, …) still pass through untouched; only the fields the transport is
 * responsible for are protected.
 */
export function buildBody(input: BuildBodyInput): Record<string, unknown> {
    const { wire, model, options, stream, support } = input;
    const extra = sanitizeExtra(options.extra);
    const json = options.responseFormat ? planJson(options.responseFormat, support) : null;
    const messages = json?.instruction ? withSystemInstruction(options.messages, json.instruction) : options.messages;

    if (wire === 'anthropic') return buildAnthropicBody(model, messages, options, stream, extra, json);
    if (wire === 'google') return buildGoogleBody(messages, options, extra, json);
    return buildOpenAiBody(model, messages, options, stream, extra, json, input.maxTokensField ?? 'max_tokens');
}

/** Strip the fields the transport owns, so `extra` cannot fight the URL or the JSON tier. */
function sanitizeExtra(extra: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!extra) return {};
    const clean = { ...extra };
    for (const key of RESERVED_BODY_KEYS) delete clean[key];
    return clean;
}

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

/**
 * How one call's JSON request is spelled on one route.
 *
 *  • `enforced` — the provider enforces `schema` (strict tier, route supports it).
 *  • `object`   — the provider's JSON mode: valid JSON, schema not enforced.
 *  • `instructed` — no native support at all; the system instruction is the whole mechanism,
 *    and the instrumented client's parse is the only check.
 *
 * The SYSTEM INSTRUCTION IS ADDED IN EVERY MODE. OpenAI, DeepSeek, Groq and Mistral all
 * require the prompt itself to ask for JSON when JSON mode is on (OpenAI's spec warns of "an
 * unending stream of whitespace" otherwise), and it is the only mechanism on an instructed
 * route. It carries the schema whenever the provider is not enforcing it.
 */
export interface JsonPlan {
    mode: 'enforced' | 'object' | 'instructed';
    format: AiResponseFormat;
    instruction: string;
}

export function planJson(format: AiResponseFormat, support: GatewayRouteSupport): JsonPlan {
    const mode: JsonPlan['mode'] =
        format.strict && format.schema && support.jsonSchema
            ? 'enforced'
            : support.jsonObject
              ? 'object'
              : 'instructed';
    const lines = ['Respond with a single JSON object and nothing else — no prose, no Markdown code fences.'];
    if (format.schema && mode !== 'enforced') {
        lines.push(`The object must conform to this JSON Schema:\n${JSON.stringify(format.schema)}`);
    }
    return { mode, format, instruction: lines.join('\n') };
}

/** Prepend the JSON instruction as the FIRST system message, ahead of the caller's own. */
function withSystemInstruction(messages: AiMessage[], instruction: string): AiMessage[] {
    return [{ role: 'system', content: instruction }, ...messages];
}

// ---------------------------------------------------------------------------
// Dialects
// ---------------------------------------------------------------------------

/** OpenAI-shaped content: a string stays a string; parts become `text` / `image_url` parts. */
function openAiContent(content: AiMessage['content']): unknown {
    if (typeof content === 'string') return content;
    return content.map((part: AiContentPart) =>
        part.type === 'text'
            ? { type: 'text', text: part.text }
            : // Data URL, not a hosted URL — see `AiContentPart`. `detail` is left to the
              // provider default: its accepted values differ across OpenAI, Azure and Groq.
              { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.data}` } },
    );
}

function buildOpenAiBody(
    model: string | null,
    messages: AiMessage[],
    options: AiCallOptions,
    stream: boolean,
    extra: Record<string, unknown>,
    json: JsonPlan | null,
    maxTokensField: 'max_tokens' | 'max_completion_tokens',
): Record<string, unknown> {
    return {
        ...extra,
        ...(model ? { model } : {}),
        messages: messages.map((m) => ({
            role: m.role,
            content: openAiContent(m.content),
            ...(m.name !== undefined ? { name: m.name } : {}),
        })),
        ...(options.maxTokens !== undefined ? { [maxTokensField]: options.maxTokens } : {}),
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(json?.mode === 'enforced'
            ? {
                  response_format: {
                      type: 'json_schema',
                      json_schema: { name: json.format.name ?? 'response', schema: json.format.schema, strict: true },
                  },
              }
            : json?.mode === 'object'
              ? { response_format: { type: 'json_object' } }
              : {}),
        ...(stream
            ? {
                  stream: true,
                  // UNCONDITIONAL, NOT CALLER-OPT-IN. OpenAI-shaped providers report NO
                  // token usage on streamed responses by default; metering built and tested
                  // against the non-streaming path otherwise reports ZERO tokens for every
                  // streamed call — and streaming is the user-facing path, so that is most of
                  // the traffic. The dashboards do not error; they confidently report a
                  // fraction of reality.
                  stream_options: { include_usage: true },
              }
            : {}),
    };
}

/** Anthropic content: `text` blocks and base64 `image` blocks. */
function anthropicContent(content: AiMessage['content']): unknown {
    if (typeof content === 'string') return content;
    return content.map((part: AiContentPart) =>
        part.type === 'text'
            ? { type: 'text', text: part.text }
            : { type: 'image', source: { type: 'base64', media_type: part.mimeType, data: part.data } },
    );
}

function buildAnthropicBody(
    model: string | null,
    messages: AiMessage[],
    options: AiCallOptions,
    stream: boolean,
    extra: Record<string, unknown>,
    json: JsonPlan | null,
): Record<string, unknown> {
    const { system: extraSystem, ...rest } = extra;
    const system = mergeAnthropicSystem(
        messages
            .filter((m) => m.role === 'system')
            .map((m) => messageText(m.content))
            .join('\n'),
        extraSystem,
    );

    return {
        ...rest,
        ...(model ? { model } : {}),
        ...(system ? { system } : {}),
        messages: messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: anthropicContent(m.content),
            })),
        // REQUIRED by Anthropic, so a call with no budget (and a task with none) still gets one.
        max_tokens: options.maxTokens ?? 1024,
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        // Structured outputs, GA with no beta header. Anthropic has no schema-less JSON mode,
        // so the default tier is instructed only. NOT forced tool use: `tool_choice:
        // {type:'tool'}` returns 400 on the newest Claude models, and assistant prefill is
        // gone from 4.6 onwards.
        ...(json?.mode === 'enforced'
            ? { output_config: { format: { type: 'json_schema', schema: json.format.schema } } }
            : {}),
        ...(stream ? { stream: true } : {}),
    };
}

/**
 * Anthropic `system`: the system messages (JSON instruction first), then whatever the caller
 * passed in `extra.system`.
 *
 * A BLOCK ARRAY is kept as blocks — that is how prompt caching is expressed (`cache_control`
 * on a block), and flattening it to a string would silently disable the cache. The messages'
 * text becomes a leading text block. A string is appended. Anything else is dropped.
 */
function mergeAnthropicSystem(text: string, extraSystem: unknown): string | unknown[] | undefined {
    if (Array.isArray(extraSystem)) {
        return text ? [{ type: 'text', text }, ...extraSystem] : extraSystem.length ? extraSystem : undefined;
    }
    const parts = [text, typeof extraSystem === 'string' ? extraSystem : ''].filter(Boolean);
    return parts.length ? parts.join('\n') : undefined;
}

/**
 * Gemini parts: `{ text }` and `{ inlineData }`.
 *
 * CAMELCASE, as the v1 discovery document names every field. Proto-JSON also accepts
 * snake_case, but the discovery document carries a deprecated `_responseJsonSchema` beside
 * `responseJsonSchema`, so snake_case names are not guaranteed to map to the field meant.
 */
function googleParts(content: AiMessage['content']): Array<Record<string, unknown>> {
    if (typeof content === 'string') return [{ text: content }];
    return content.map((part: AiContentPart) =>
        part.type === 'text' ? { text: part.text } : { inlineData: { mimeType: part.mimeType, data: part.data } },
    );
}

/**
 * Gemini's `generateContent` body.
 *
 * The model id is NOT here — it is a path segment (see the `google-ai-studio` adapter), so
 * putting it in the body too is at best ignored and at worst a 400.
 */
function buildGoogleBody(
    messages: AiMessage[],
    options: AiCallOptions,
    extra: Record<string, unknown>,
    json: JsonPlan | null,
): Record<string, unknown> {
    // `systemInstruction` is "currently text only" on v1 — image parts never reach it, because
    // `validateCallContent` refuses images outside user turns.
    const system = messages
        .filter((m) => m.role === 'system')
        .map((m) => messageText(m.content))
        .join('\n');

    // Gemini rejects consecutive turns with the same role, which a `[user, user]` history
    // (perfectly legal in this package's call options) would otherwise produce.
    const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];
    for (const message of messages) {
        if (message.role === 'system') continue;
        const role = message.role === 'assistant' ? 'model' : 'user';
        const parts = googleParts(message.content);
        const last = contents[contents.length - 1];
        if (last && last.role === role) {
            last.parts.push(...parts);
            continue;
        }
        contents.push({ role, parts });
    }

    const callerConfig =
        typeof extra.generationConfig === 'object' && extra.generationConfig !== null
            ? { ...(extra.generationConfig as Record<string, unknown>) }
            : {};
    for (const key of RESERVED_GENERATION_CONFIG_KEYS) delete callerConfig[key];

    const generationConfig: Record<string, unknown> = {
        ...callerConfig,
        ...(options.maxTokens !== undefined ? { maxOutputTokens: options.maxTokens } : {}),
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        // Default tier: JSON mode. Strict tier: `responseFormat`, the ONLY non-deprecated schema
        // field on v1 (`responseSchema` and `responseJsonSchema` are both "Deprecated. Use
        // response_format instead"). It takes a standard JSON Schema. Never both styles at once.
        ...(json?.mode === 'object' ? { responseMimeType: 'application/json' } : {}),
        ...(json?.mode === 'enforced'
            ? { responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: json.format.schema } } }
            : {}),
    };

    const rest = { ...extra };
    delete rest.generationConfig;

    return {
        ...rest,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
    };
}

// ---------------------------------------------------------------------------
// Response normalisation
// ---------------------------------------------------------------------------

/** Normalise a non-streamed provider payload into the package's own result shape. */
export function normalizeResult(
    wire: GatewayWire,
    payload: Record<string, unknown>,
    provider: string,
    fallbackModel: string | null,
): AiCallResult {
    if (wire === 'anthropic') {
        const content = payload.content as Array<{ type?: string; text?: string }> | undefined;
        const usage = payload.usage as { input_tokens?: number; output_tokens?: number } | undefined;
        return {
            text: (content ?? []).map((block) => (block.type === 'text' ? (block.text ?? '') : '')).join(''),
            tokens: usage ? { input: usage.input_tokens ?? 0, output: usage.output_tokens ?? 0 } : null,
            model: (payload.model as string) ?? fallbackModel ?? '',
            provider,
            raw: payload,
        };
    }

    if (wire === 'google') {
        const candidates = payload.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
        const usage = payload.usageMetadata as
            | { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number }
            | undefined;
        return {
            text: googleText(candidates),
            tokens: usage
                ? {
                      input: usage.promptTokenCount ?? 0,
                      output: usage.candidatesTokenCount ?? 0,
                      ...(usage.cachedContentTokenCount !== undefined ? { cached: usage.cachedContentTokenCount } : {}),
                  }
                : null,
            // Gemini echoes the model as `modelVersion`, not `model`.
            model: (payload.modelVersion as string) ?? fallbackModel ?? '',
            provider,
            raw: payload,
        };
    }

    const choices = payload.choices as Array<{ message?: { content?: string } }> | undefined;
    const usage = payload.usage as
        | { prompt_tokens?: number; completion_tokens?: number; cached_tokens?: number }
        | undefined;
    return {
        text: choices?.[0]?.message?.content ?? '',
        tokens: usage
            ? {
                  input: usage.prompt_tokens ?? 0,
                  output: usage.completion_tokens ?? 0,
                  ...(usage.cached_tokens !== undefined ? { cached: usage.cached_tokens } : {}),
              }
            : null,
        model: (payload.model as string) ?? fallbackModel ?? '',
        provider,
        raw: payload,
    };
}

function googleText(candidates: Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined): string {
    return (candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('');
}

// ---------------------------------------------------------------------------
// Stream frames
// ---------------------------------------------------------------------------

export interface WireStreamReader {
    /** Translate one decoded SSE payload object into typed events. */
    handle(parsed: Record<string, unknown>): AiStreamEvent[];
    /** The model the provider reported, once it has reported one. */
    model(): string | undefined;
}

/**
 * A per-stream frame translator.
 *
 * STATEFUL BY NECESSITY: Anthropic reports input tokens ONCE, in `message_start`, and output
 * tokens later in `message_delta`. A stateless translator that emits usage only from
 * `message_delta` reports zero prompt tokens for every streamed Anthropic call — dashboards
 * do not error, they just under-report.
 */
export function createStreamReader(wire: GatewayWire): WireStreamReader {
    let model: string | undefined;
    let anthropicInputTokens = 0;

    return {
        model: () => model,

        handle(parsed) {
            const events: AiStreamEvent[] = [];

            if (typeof parsed.model === 'string') model = parsed.model;
            if (typeof parsed.modelVersion === 'string') model = parsed.modelVersion;

            if (wire === 'anthropic') {
                const type = parsed.type as string | undefined;
                if (type === 'message_start') {
                    const message = parsed.message as { model?: string; usage?: { input_tokens?: number } } | undefined;
                    if (typeof message?.model === 'string') model = message.model;
                    anthropicInputTokens = message?.usage?.input_tokens ?? 0;
                } else if (type === 'content_block_delta') {
                    const delta = parsed.delta as { text?: string } | undefined;
                    if (delta?.text) events.push({ type: 'delta', text: delta.text });
                } else if (type === 'message_delta') {
                    const usage = parsed.usage as { output_tokens?: number } | undefined;
                    if (usage) {
                        events.push({
                            type: 'usage',
                            tokens: { input: anthropicInputTokens, output: usage.output_tokens ?? 0 },
                        });
                    }
                }
                return events;
            }

            if (wire === 'google') {
                const usage = parsed.usageMetadata as
                    | { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number }
                    | undefined;
                if (usage) {
                    // Gemini's usageMetadata is CUMULATIVE per frame, and the instrumented
                    // client keeps the last value, so emitting on every frame is correct.
                    events.push({
                        type: 'usage',
                        tokens: {
                            input: usage.promptTokenCount ?? 0,
                            output: usage.candidatesTokenCount ?? 0,
                            ...(usage.cachedContentTokenCount !== undefined
                                ? { cached: usage.cachedContentTokenCount }
                                : {}),
                        },
                    });
                }
                const candidates = parsed.candidates as
                    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
                    | undefined;
                const text = googleText(candidates);
                if (text) events.push({ type: 'delta', text });
                return events;
            }

            const usage = parsed.usage as
                | { prompt_tokens?: number; completion_tokens?: number; cached_tokens?: number }
                | undefined;
            if (usage) {
                events.push({
                    type: 'usage',
                    tokens: {
                        input: usage.prompt_tokens ?? 0,
                        output: usage.completion_tokens ?? 0,
                        ...(usage.cached_tokens !== undefined ? { cached: usage.cached_tokens } : {}),
                    },
                });
            }
            const choices = parsed.choices as Array<{ delta?: { content?: string } }> | undefined;
            const text = choices?.[0]?.delta?.content;
            if (text) events.push({ type: 'delta', text });
            return events;
        },
    };
}
