// ============================================================
// @ottabase/ottaai, Call content: images + JSON output
// ============================================================
// The provider-NEUTRAL half of multimodal input and structured output. Lives in
// the dependency-free root so a browser upload form, a worker route and every
// transport read the SAME mime list, the SAME size limits and the SAME parser.
//
// The provider-SPECIFIC half: how an image part or a JSON request is spelled
// on each wire, lives in `transports/wire.ts`, next to the dialect it belongs to.
// ============================================================

import type { AiCapability } from './registry';

/**
 * Image types every wire with verified image support accepts.
 *
 * The INTERSECTION, not the union: Anthropic accepts exactly these four, and a type one
 * provider takes and another rejects turns a provider switch into a 400 that reads as a
 * bug in the image rather than in the selection.
 */
export const AI_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

export type AiImageMimeType = (typeof AI_IMAGE_MIME_TYPES)[number];

/**
 * One part of a multi-part message.
 *
 * IMAGES ARE INLINE BASE64 ONLY, no URLs. A URL makes the PROVIDER fetch from wherever the
 * caller pointed it (Gemini cannot fetch arbitrary URLs at all), and the bytes the model saw
 * are then no longer the bytes the app validated and sized.
 */
export type AiContentPart =
    | { type: 'text'; text: string }
    | {
          type: 'image';
          mimeType: AiImageMimeType;
          /** Standard base64 of the image bytes. NO `data:` prefix. */
          data: string;
      };

/** A chat message. Images are accepted in `user` messages only. */
export interface AiMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | AiContentPart[];
    name?: string;
}

/**
 * Ask for a JSON object instead of prose.
 *
 * THE ROOT IS ALWAYS AN OBJECT. OpenAI's `json_object` and every provider's strict structured
 * output require one, so an array-rooted contract would work on some providers and fail on
 * the rest. Wrap a list in a property (`{ "items": [...] }`).
 *
 * TWO TIERS, because "JSON" means different things on different wires:
 *
 *  • default: the provider's JSON MODE where it has one (valid JSON, no schema enforcement),
 *    with `schema` written into the system instruction. Accepts ANY JSON Schema on EVERY
 *    provider, so a schema that works with one tenant's key works with all of them.
 *  • `strict: true`: the provider ENFORCES `schema` where its wire supports that (OpenAI,
 *    Mistral, Perplexity, Anthropic, Gemini), and falls back to the default tier where it
 *    does not (DeepSeek, Groq, Azure, dynamic routes, Unified Billing). The schema must then
 *    fit the strict subset those providers share: every property listed in `required`,
 *    `additionalProperties: false` on every object. A schema outside it is a provider 400.
 *
 * Either way the package checks only that the reply parses to an object: validate the shape
 * yourself (zod, valibot, …) before trusting it.
 */
export interface AiResponseFormat {
    type: 'json';
    schema?: Record<string, unknown>;
    /** Ask the provider to ENFORCE `schema` where it can. Requires `schema`. Default false. */
    strict?: boolean;
    /** Schema name, where a provider wants one. `^[a-zA-Z0-9_-]{1,64}$`. Default `response`. */
    name?: string;
}

/**
 * Hard ceilings the package enforces before a request is built.
 *
 * Byte limits are the STRICTEST verified limit across the wires that accept images, so a
 * request that passes here is not rejected for size by whichever provider the resolver
 * happens to select. Image COUNT is narrower on some providers (Groq 3, Mistral 8, Azure 10);
 * the gateway transport enforces those per provider and refuses before sending.
 *
 * A provider-compatibility floor, not a product budget: an app route should set its own,
 * tighter limits (otta-web's `/api/ai/complete` does).
 */
export const AI_CONTENT_LIMITS = Object.freeze({
    /** Decoded bytes per image. Anthropic allows 10 MB of BASE64 per image (≈7.5 MB decoded). */
    imageBytes: 5 * 1024 * 1024,
    /**
     * Decoded bytes across all images in one request. Gemini caps the WHOLE inline request at
     * 20 MB; 14 MB decoded is ≈18.7 MB as base64, leaving room for the text.
     */
    totalImageBytes: 14 * 1024 * 1024,
    /** Images per request, before any provider-specific cap. */
    images: 20,
});

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const SCHEMA_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

/** Decoded byte length of a base64 string, without decoding it. */
export function base64DecodedBytes(data: string): number {
    const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
    return Math.floor((data.length * 3) / 4) - padding;
}

/** The text of a message, with image parts dropped. */
export function messageText(content: AiMessage['content']): string {
    if (typeof content === 'string') return content;
    return content
        .filter((part): part is Extract<AiContentPart, { type: 'text' }> => part.type === 'text')
        .map((part) => part.text)
        .join('\n');
}

/** Whether any message carries an image part. */
export function hasImages(messages: readonly AiMessage[]): boolean {
    return messages.some((m) => typeof m.content !== 'string' && m.content.some((part) => part.type === 'image'));
}

/**
 * The capabilities a call NEEDS from the model that serves it.
 *
 * The instrumented client checks these against the TASK's `requiredCapabilities`, because the
 * task declaration is what filtered the credential and the platform model in the first place.
 * A call that needs `vision` on a task that never asked for it was resolved without that
 * filter, and could be sent to a text-only model.
 */
export function capabilitiesForCall(input: {
    messages: readonly AiMessage[];
    responseFormat?: AiResponseFormat;
}): AiCapability[] {
    const needed: AiCapability[] = [];
    if (hasImages(input.messages)) needed.push('vision');
    if (input.responseFormat) needed.push('json');
    return needed;
}

/**
 * Validate call content before any request is built.
 *
 * Runs on UNTRUSTED shapes on purpose (`unknown` reads, `typeof` checks): call options are
 * often assembled from a request body, and a provider answering a malformed part with its
 * own schema error debugs as a transport bug.
 */
export function validateCallContent(input: {
    messages: unknown;
    responseFormat?: unknown;
}): { ok: true } | { ok: false; message: string } {
    if (!Array.isArray(input.messages) || input.messages.length === 0) {
        return { ok: false, message: 'messages must be a non-empty array.' };
    }

    let images = 0;
    let imageBytes = 0;
    for (const [index, message] of input.messages.entries()) {
        const m = message as { role?: unknown; content?: unknown };
        if (m.role !== 'system' && m.role !== 'user' && m.role !== 'assistant' && m.role !== 'tool') {
            return { ok: false, message: `messages[${index}].role is not a supported role.` };
        }
        if (typeof m.content === 'string') continue;
        if (!Array.isArray(m.content) || m.content.length === 0) {
            return { ok: false, message: `messages[${index}].content must be a string or a non-empty array of parts.` };
        }
        for (const [partIndex, raw] of m.content.entries()) {
            const part = raw as { type?: unknown; text?: unknown; mimeType?: unknown; data?: unknown };
            const where = `messages[${index}].content[${partIndex}]`;
            if (part.type === 'text') {
                if (typeof part.text !== 'string') return { ok: false, message: `${where}.text must be a string.` };
                continue;
            }
            if (part.type !== 'image') return { ok: false, message: `${where}.type must be "text" or "image".` };
            // Providers that accept images accept them from the user turn only.
            if (m.role !== 'user')
                return { ok: false, message: `${where}: images are only accepted in user messages.` };
            if (
                typeof part.mimeType !== 'string' ||
                !(AI_IMAGE_MIME_TYPES as readonly string[]).includes(part.mimeType)
            ) {
                return { ok: false, message: `${where}.mimeType must be one of ${AI_IMAGE_MIME_TYPES.join(', ')}.` };
            }
            if (typeof part.data !== 'string' || !BASE64.test(part.data) || part.data.length % 4 !== 0) {
                return { ok: false, message: `${where}.data must be standard base64 with no "data:" prefix.` };
            }
            const bytes = base64DecodedBytes(part.data);
            if (bytes > AI_CONTENT_LIMITS.imageBytes) {
                return {
                    ok: false,
                    message: `${where} is ${bytes} bytes; the limit is ${AI_CONTENT_LIMITS.imageBytes}.`,
                };
            }
            images += 1;
            imageBytes += bytes;
        }
    }
    if (images > AI_CONTENT_LIMITS.images) {
        return { ok: false, message: `${images} images; the limit is ${AI_CONTENT_LIMITS.images} per request.` };
    }
    if (imageBytes > AI_CONTENT_LIMITS.totalImageBytes) {
        return {
            ok: false,
            message: `Images total ${imageBytes} bytes; the limit is ${AI_CONTENT_LIMITS.totalImageBytes} per request.`,
        };
    }

    if (input.responseFormat !== undefined) {
        const format = input.responseFormat as { type?: unknown; schema?: unknown; name?: unknown; strict?: unknown };
        if (format === null || typeof format !== 'object' || format.type !== 'json') {
            return { ok: false, message: 'responseFormat.type must be "json".' };
        }
        if (format.strict !== undefined && typeof format.strict !== 'boolean') {
            return { ok: false, message: 'responseFormat.strict must be a boolean.' };
        }
        if (format.strict === true && format.schema === undefined) {
            return { ok: false, message: 'responseFormat.strict requires a schema to enforce.' };
        }
        if (format.name !== undefined && (typeof format.name !== 'string' || !SCHEMA_NAME.test(format.name))) {
            return { ok: false, message: 'responseFormat.name must match ^[a-zA-Z0-9_-]{1,64}$.' };
        }
        if (format.schema !== undefined) {
            const schema = format.schema as { type?: unknown } | null;
            if (schema === null || typeof schema !== 'object' || Array.isArray(schema) || schema.type !== 'object') {
                return { ok: false, message: 'responseFormat.schema must be a JSON Schema with type "object".' };
            }
        }
    }
    return { ok: true };
}

/**
 * Parse a model's JSON reply into an object, or `undefined` when it is not one.
 *
 * Tolerates exactly one thing: a single Markdown code fence around the payload, which models
 * add when JSON is instructed rather than enforced. It does NOT hunt for the first `{` in
 * surrounding prose, a reply that needs that is not the JSON that was asked for, and
 * "repairing" it hides a model that is ignoring the instruction.
 */
export function parseJsonObject(text: string): Record<string, unknown> | undefined {
    let body = text.trim();
    const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(body);
    if (fenced) body = fenced[1]!.trim();
    try {
        const parsed: unknown = JSON.parse(body);
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
}
