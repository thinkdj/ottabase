// ============================================================
// Cloudflare AI Gateway Provider
// ============================================================
// Uses Cloudflare AI Gateway as a proxy to external AI providers.
// Benefits: caching, rate limiting, analytics, fallback routing.
//
// This provider calls external APIs (OpenAI DALL-E, Stability, etc.)
// through the Gateway for observability and cost control.
//
// Use this when you need models beyond what Workers AI offers,
// or want gateway features like caching identical prompts.
// ============================================================

import type { AIImageProvider, ImageGenerationParams, ImageGenerationOutput } from '../types';

export interface AIGatewayConfig {
    /** Cloudflare account ID */
    accountId: string;
    /** AI Gateway name/slug */
    gatewayId: string;
    /** Provider to route through (e.g., 'openai', 'stability-ai') */
    provider: 'openai' | 'stability-ai' | 'replicate';
    /** API key for the external provider */
    apiKey: string;
    /** Default model to use */
    defaultModel?: string;
}

/**
 * Create an AI Gateway provider for external model access.
 *
 * The gateway URL pattern:
 *   https://gateway.ai.cloudflare.com/v1/{accountId}/{gatewayId}/{provider}/...
 */
export function createAIGatewayProvider(config: AIGatewayConfig): AIImageProvider {
    const baseUrl = `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}`;

    return {
        name: `ai-gateway-${config.provider}`,
        supportedModels: getProviderModels(config.provider),

        async generate(params: ImageGenerationParams): Promise<ImageGenerationOutput> {
            const startTime = Date.now();

            switch (config.provider) {
                case 'openai':
                    return generateViaOpenAI(baseUrl, config.apiKey, params, startTime);
                case 'stability-ai':
                    return generateViaStability(baseUrl, config.apiKey, params, startTime);
                case 'replicate':
                    return generateViaReplicate(baseUrl, config.apiKey, params, startTime);
                default:
                    throw new Error(`Unsupported gateway provider: ${config.provider}`);
            }
        },
    };
}

// ── Provider-specific implementations ───────────────────────

async function generateViaOpenAI(
    baseUrl: string,
    apiKey: string,
    params: ImageGenerationParams,
    startTime: number,
): Promise<ImageGenerationOutput> {
    const model = params.model || 'dall-e-3';
    const size = `${params.width}x${params.height}`;

    const response = await fetch(`${baseUrl}/openai/images/generations`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            prompt: params.prompt,
            n: 1,
            size,
            response_format: 'b64_json',
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as { data: Array<{ b64_json: string }> };
    const b64 = data.data[0].b64_json;
    const imageData = base64ToBuffer(b64);

    return {
        imageData,
        format: 'png',
        model,
        provider: 'openai-via-gateway',
        durationMs: Date.now() - startTime,
    };
}

async function generateViaStability(
    baseUrl: string,
    apiKey: string,
    params: ImageGenerationParams,
    startTime: number,
): Promise<ImageGenerationOutput> {
    const model = params.model || 'stable-diffusion-xl-1024-v1-0';

    const response = await fetch(
        `${baseUrl}/stability-ai/v1/generation/${model}/text-to-image`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                text_prompts: [
                    { text: params.prompt, weight: 1 },
                    ...(params.negativePrompt ? [{ text: params.negativePrompt, weight: -1 }] : []),
                ],
                cfg_scale: params.guidanceScale ?? 7,
                steps: params.steps ?? 30,
                width: params.width,
                height: params.height,
                seed: params.seed ?? 0,
                samples: 1,
            }),
        },
    );

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Stability AI error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as {
        artifacts: Array<{ base64: string; seed: number }>;
    };
    const artifact = data.artifacts[0];
    const imageData = base64ToBuffer(artifact.base64);

    return {
        imageData,
        format: 'png',
        model,
        provider: 'stability-via-gateway',
        seed: artifact.seed,
        durationMs: Date.now() - startTime,
    };
}

async function generateViaReplicate(
    baseUrl: string,
    apiKey: string,
    params: ImageGenerationParams,
    startTime: number,
): Promise<ImageGenerationOutput> {
    const model = params.model || 'black-forest-labs/flux-schnell';

    // Replicate uses a prediction API
    const response = await fetch(`${baseUrl}/replicate/v1/predictions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            input: {
                prompt: params.prompt,
                width: params.width,
                height: params.height,
                num_inference_steps: params.steps ?? 4,
                guidance_scale: params.guidanceScale ?? 3.5,
                ...(params.seed !== undefined ? { seed: params.seed } : {}),
            },
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Replicate API error (${response.status}): ${err}`);
    }

    const prediction = (await response.json()) as { output: string | string[] };
    const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;

    // Download the image
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
        throw new Error(`Failed to download generated image from Replicate`);
    }
    const imageData = await imgResponse.arrayBuffer();

    return {
        imageData,
        format: 'png',
        model,
        provider: 'replicate-via-gateway',
        durationMs: Date.now() - startTime,
    };
}

// ── Helpers ─────────────────────────────────────────────────

function getProviderModels(provider: string): string[] {
    switch (provider) {
        case 'openai':
            return ['dall-e-3', 'dall-e-2'];
        case 'stability-ai':
            return ['stable-diffusion-xl-1024-v1-0', 'stable-diffusion-v1-6'];
        case 'replicate':
            return ['black-forest-labs/flux-schnell', 'black-forest-labs/flux-dev'];
        default:
            return [];
    }
}

function base64ToBuffer(b64: string): ArrayBuffer {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        buf[i] = bin.charCodeAt(i);
    }
    return buf.buffer;
}
