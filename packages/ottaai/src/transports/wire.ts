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
// SCOPE: text chat completion ONLY. See `AiCallOptions` — message content is a
// bare string, so images, audio, tool calls and embeddings have no representation
// to serialise. A dialect here therefore never grows a multimodal branch without
// the call contract growing first.
// ============================================================

import type { AiCallOptions, AiCallResult, AiStreamEvent } from '../resolver/transport';
import type { GatewayWire } from './providers';

/** Fields the transport owns. `extra` may never set them — see `buildBody`. */
const RESERVED_BODY_KEYS = ['model', 'messages', 'stream', 'contents', 'system_instruction'] as const;

export interface BuildBodyInput {
    wire: GatewayWire;
    /** Bare model id, or null when the provider carries it in the path (Google, Azure). */
    model: string | null;
    options: AiCallOptions;
    stream: boolean;
}

/**
 * Build the request body for a dialect.
 *
 * `extra` IS SPREAD FIRST, ON PURPOSE. Spreading it last lets a caller overwrite `messages`,
 * `model` or `stream` — and the URL was already chosen from those same values, so the
 * request would be routed for one call and bodied for another. Provider-specific knobs
 * (`top_p`, `stop`, `response_format`, …) still pass through untouched; only the fields the
 * transport is responsible for are protected.
 */
export function buildBody(input: BuildBodyInput): Record<string, unknown> {
    const { wire, model, options, stream } = input;
    const extra = sanitizeExtra(options.extra);

    if (wire === 'anthropic') return buildAnthropicBody(model, options, stream, extra);
    if (wire === 'google') return buildGoogleBody(options, extra);
    return buildOpenAiBody(model, options, stream, extra);
}

/** Strip the fields the transport owns, so `extra` cannot fight the URL. */
function sanitizeExtra(extra: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!extra) return {};
    const clean = { ...extra };
    for (const key of RESERVED_BODY_KEYS) delete clean[key];
    return clean;
}

function buildOpenAiBody(
    model: string | null,
    options: AiCallOptions,
    stream: boolean,
    extra: Record<string, unknown>,
): Record<string, unknown> {
    return {
        ...extra,
        ...(model ? { model } : {}),
        messages: options.messages,
        ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
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

function buildAnthropicBody(
    model: string | null,
    options: AiCallOptions,
    stream: boolean,
    extra: Record<string, unknown>,
): Record<string, unknown> {
    const system = options.messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n');

    // `max_tokens` is REQUIRED by Anthropic, so it always ends up present — but a caller who
    // set it through `extra` must not have it stomped by the default.
    const extraMaxTokens = typeof extra.max_tokens === 'number' ? extra.max_tokens : undefined;

    return {
        ...extra,
        ...(model ? { model } : {}),
        ...(system ? { system } : {}),
        messages: options.messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        max_tokens: options.maxTokens ?? extraMaxTokens ?? 1024,
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(stream ? { stream: true } : {}),
    };
}

/**
 * Gemini's `generateContent` body.
 *
 * The model id is NOT here — it is a path segment (see the `google-ai-studio` adapter), so
 * putting it in the body too is at best ignored and at worst a 400.
 */
function buildGoogleBody(options: AiCallOptions, extra: Record<string, unknown>): Record<string, unknown> {
    const system = options.messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n');

    // Gemini rejects consecutive turns with the same role, which a `[user, user]` history
    // (perfectly legal in this package's call options) would otherwise produce.
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    for (const message of options.messages) {
        if (message.role === 'system') continue;
        const role = message.role === 'assistant' ? 'model' : 'user';
        const last = contents[contents.length - 1];
        if (last && last.role === role) {
            last.parts.push({ text: message.content });
            continue;
        }
        contents.push({ role, parts: [{ text: message.content }] });
    }

    const generationConfig: Record<string, unknown> = {
        ...(typeof extra.generationConfig === 'object' && extra.generationConfig !== null
            ? (extra.generationConfig as Record<string, unknown>)
            : {}),
        ...(options.maxTokens !== undefined ? { maxOutputTokens: options.maxTokens } : {}),
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    };

    const rest = { ...extra };
    delete rest.generationConfig;

    return {
        ...rest,
        ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
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
