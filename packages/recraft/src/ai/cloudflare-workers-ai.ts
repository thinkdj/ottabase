// ============================================================
// Cloudflare Workers AI Provider
// ============================================================
// Native integration with Cloudflare's edge AI inference.
// Supports FLUX-1-schnell (fast) and Stable Diffusion XL (quality).
//
// This is the recommended provider for Ottabase since the platform
// already runs on Cloudflare Workers — no external API keys needed.
// ============================================================

import type { AIImageProvider, ImageGenerationParams, ImageGenerationOutput } from '../types';

/**
 * Supported Cloudflare Workers AI image models.
 *
 * flux-1-schnell:  Fast (~2-4s), good quality, best for iteration
 * sdxl-base:       Higher quality, slower (~10-15s), best for final assets
 * sdxl-lightning:  Fast variant of SDXL with fewer steps needed
 */
export const CF_MODELS = {
    'flux-1-schnell': '@cf/black-forest-labs/flux-1-schnell',
    'sdxl-base': '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    'sdxl-lightning': '@cf/bytedance/stable-diffusion-xl-lightning',
} as const;

export type CFModelKey = keyof typeof CF_MODELS;

const DEFAULT_MODEL: CFModelKey = 'flux-1-schnell';

/** The Cloudflare AI binding type (from Workers runtime) */
interface CloudflareAI {
    run(
        model: string,
        inputs: Record<string, unknown>,
    ): Promise<Uint8Array | ReadableStream | Record<string, unknown>>;
}

/**
 * Create a Cloudflare Workers AI image provider.
 *
 * @param ai  The AI binding from the Cloudflare Worker env (env.AI)
 */
export function createCloudflareAIProvider(ai: CloudflareAI): AIImageProvider {
    return {
        name: 'cloudflare-workers-ai',
        supportedModels: Object.keys(CF_MODELS),

        async generate(params: ImageGenerationParams): Promise<ImageGenerationOutput> {
            const modelKey = (params.model as CFModelKey) || DEFAULT_MODEL;
            const modelId = CF_MODELS[modelKey] ?? CF_MODELS[DEFAULT_MODEL];

            const startTime = Date.now();

            // Build the full prompt with style suffix already merged
            const inputs: Record<string, unknown> = {
                prompt: params.prompt,
            };

            // FLUX models use `num_steps` instead of `steps`
            if (modelKey === 'flux-1-schnell') {
                inputs.num_steps = Math.min(params.steps ?? 4, 8); // FLUX-schnell max 8 steps
                if (params.width) inputs.width = clampDimension(params.width);
                if (params.height) inputs.height = clampDimension(params.height);
            } else {
                // SDXL models
                if (params.negativePrompt) inputs.negative_prompt = params.negativePrompt;
                if (params.guidanceScale) inputs.guidance = params.guidanceScale;
                if (params.steps) inputs.num_steps = params.steps;
                if (params.width) inputs.width = clampDimension(params.width);
                if (params.height) inputs.height = clampDimension(params.height);
            }

            if (params.seed !== undefined) {
                inputs.seed = params.seed;
            }

            const result = await ai.run(modelId, inputs);

            const durationMs = Date.now() - startTime;

            // Workers AI returns raw image bytes (PNG) for image models
            let imageData: ArrayBuffer;
            if (result instanceof Uint8Array) {
                imageData = result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
            } else if (result instanceof ReadableStream) {
                imageData = await streamToBuffer(result);
            } else if (result && typeof result === 'object' && 'image' in result) {
                // Some models return { image: base64string }
                const b64 = result.image as string;
                imageData = base64ToBuffer(b64);
            } else {
                throw new Error(`Unexpected response format from model ${modelId}`);
            }

            return {
                imageData,
                format: 'png',
                model: modelKey,
                provider: 'cloudflare-workers-ai',
                seed: params.seed,
                durationMs,
            };
        },
    };
}

// ── Helpers ─────────────────────────────────────────────────

/** Clamp image dimension to Workers AI limits (multiples of 8, max 1024) */
function clampDimension(dim: number): number {
    const clamped = Math.min(Math.max(256, dim), 1024);
    return Math.round(clamped / 8) * 8; // Must be multiple of 8
}

/** Convert a ReadableStream to ArrayBuffer */
async function streamToBuffer(stream: ReadableStream): Promise<ArrayBuffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) chunks.push(value);
    }
    const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        buf.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return buf.buffer;
}

/** Decode a base64 string to ArrayBuffer */
function base64ToBuffer(b64: string): ArrayBuffer {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        buf[i] = bin.charCodeAt(i);
    }
    return buf.buffer;
}
