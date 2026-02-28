// ============================================================
// Generate API — The core image generation endpoint
// ============================================================
// POST /api/recraft/sets/:setId/generate
//
// 1. Validates input & loads the set's resolved style
// 2. Builds the full prompt (user prompt + style suffix + brand keywords)
// 3. Creates a pending RecraftGeneration record
// 4. Calls the AI provider to generate the image
// 5. Stores the image in R2
// 6. Updates the generation record with the result
// ============================================================

import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { generateImage, registerProvider, getDefaultProvider } from '../ai/provider';
import { createCloudflareAIProvider } from '../ai/cloudflare-workers-ai';
import { createAIGatewayProvider } from '../ai/cloudflare-ai-gateway';
import { RecraftGeneration } from '../ottaorm-models/RecraftGeneration';
import { RecraftSet } from '../ottaorm-models/RecraftSet';
import type { AssetType } from '../types';
import type { RecraftRouteContext } from './types';
import { readJson } from './types';

export async function handleGenerate(context: RecraftRouteContext, setId: string): Promise<Response> {
    const { env, request } = context;

    if (!env.OBCF_D1) {
        return error('D1 database binding not configured', 500, 'CONFIG_ERROR');
    }

    registerConnection('default', createD1Driver(env.OBCF_D1 as any));

    // ── 1. Load the set ─────────────────────────────────────
    const set = await RecraftSet.find(setId);
    if (!set) return error('Set not found', 404, 'NOT_FOUND');

    // ── 2. Parse request ────────────────────────────────────
    const body = await readJson<{
        prompt?: string;
        negativePrompt?: string;
        assetType?: AssetType;
        width?: number;
        height?: number;
        styleOverrides?: {
            guidanceScale?: number;
            steps?: number;
            model?: string;
        };
    }>(request);

    if (!body.prompt || body.prompt.trim().length === 0) {
        return error('Prompt is required', 400, 'VALIDATION_ERROR');
    }

    // ── 3. Resolve style ────────────────────────────────────
    const resolvedStyle = await (set as RecraftSet).getResolvedStyle();
    const settings = (set as RecraftSet).getSettings();

    // Apply per-request overrides
    if (body.styleOverrides?.guidanceScale) resolvedStyle.guidanceScale = body.styleOverrides.guidanceScale;
    if (body.styleOverrides?.steps) resolvedStyle.steps = body.styleOverrides.steps;
    if (body.styleOverrides?.model) resolvedStyle.preferredModel = body.styleOverrides.model;

    // ── 4. Build the full prompt ────────────────────────────
    const promptParts: string[] = [body.prompt.trim()];

    // Add brand keywords if configured
    if (settings.brandKeywords?.length) {
        promptParts.push(settings.brandKeywords.join(', '));
    }

    // Add the style suffix
    if (resolvedStyle.promptSuffix) {
        promptParts.push(resolvedStyle.promptSuffix);
    }

    const fullPrompt = promptParts.join(', ');

    // Build negative prompt
    const negativePrompt = body.negativePrompt || resolvedStyle.negativePrompt || undefined;

    // Determine dimensions
    const width = body.width || settings.defaultWidth || 512;
    const height = body.height || settings.defaultHeight || 512;
    const assetType = body.assetType || (settings.defaultAssetType as AssetType) || 'logo';

    // ── 5. Create pending generation record ─────────────────
    const generation = await RecraftGeneration.create({
        setId,
        prompt: body.prompt.trim(),
        negativePrompt: negativePrompt ?? null,
        assetType,
        styleSnapshotJson: JSON.stringify({
            ...resolvedStyle,
            model: resolvedStyle.preferredModel || 'flux-1-schnell',
        }),
        status: 'processing',
        userId: null,
        appId: null,
    });

    const generationId = generation.get('id') as string;

    // ── 6. Initialize AI provider ───────────────────────────
    ensureProvider(env);

    // ── 7. Generate the image ───────────────────────────────
    try {
        const result = await generateImage({
            prompt: fullPrompt,
            negativePrompt,
            width,
            height,
            guidanceScale: resolvedStyle.guidanceScale,
            steps: resolvedStyle.steps,
            model: resolvedStyle.preferredModel,
        });

        // ── 8. Store in R2 ──────────────────────────────────
        const imageKey = `recraft/${setId}/${generationId}.${result.format}`;

        if (env.OBCF_R2) {
            await env.OBCF_R2.put(imageKey, result.imageData, {
                httpMetadata: {
                    contentType: `image/${result.format}`,
                    cacheControl: 'public, max-age=31536000',
                },
                customMetadata: {
                    generationId,
                    setId,
                    model: result.model,
                    provider: result.provider,
                },
            });
        }

        // ── 9. Update generation record ─────────────────────
        const metadata = {
            width,
            height,
            model: result.model,
            provider: result.provider,
            seed: result.seed,
            durationMs: result.durationMs,
            format: result.format,
        };

        await (generation as RecraftGeneration).markCompleted(imageKey, metadata);

        // Increment set generation count
        await (set as RecraftSet).incrementGenerationCount();

        // Set cover image if this is the first generation
        if (!set.get('coverImageKey')) {
            set.set('coverImageKey', imageKey);
            await set.save();
        }

        const r2Url = env.R2_PUBLIC_URL || '/api/upload/file';

        return json({
            success: true,
            generationId,
            status: 'completed',
            imageUrl: `${r2Url}/${imageKey}`,
            metadata,
        }, 201);
    } catch (err) {
        // Mark generation as failed
        const errorMessage = err instanceof Error ? err.message : 'Unknown generation error';
        await (generation as RecraftGeneration).markFailed(errorMessage);

        return error(`Image generation failed: ${errorMessage}`, 502, 'GENERATION_ERROR');
    }
}

// ── Provider initialization ─────────────────────────────────

let providerInitialized = false;

function ensureProvider(env: RecraftRouteContext['env']): void {
    if (providerInitialized && getDefaultProvider()) return;

    // Prefer Cloudflare Workers AI if the binding exists
    if (env.AI) {
        registerProvider(createCloudflareAIProvider(env.AI as any));
        providerInitialized = true;
        return;
    }

    // Fall back to AI Gateway if configured
    if (env.RECRAFT_AI_GATEWAY_ACCOUNT_ID && env.RECRAFT_AI_GATEWAY_ID && env.RECRAFT_AI_GATEWAY_API_KEY) {
        registerProvider(
            createAIGatewayProvider({
                accountId: env.RECRAFT_AI_GATEWAY_ACCOUNT_ID,
                gatewayId: env.RECRAFT_AI_GATEWAY_ID,
                provider: (env.RECRAFT_AI_GATEWAY_PROVIDER as 'openai' | 'stability-ai' | 'replicate') || 'openai',
                apiKey: env.RECRAFT_AI_GATEWAY_API_KEY,
            }),
        );
        providerInitialized = true;
        return;
    }

    throw new Error(
        'No AI provider configured. Either add an AI binding (env.AI) in wrangler.jsonc, ' +
        'or set RECRAFT_AI_GATEWAY_* env vars for Cloudflare AI Gateway.',
    );
}

// ── Helpers ─────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function error(message: string, status = 400, code?: string): Response {
    return new Response(JSON.stringify({ error: message, code: code || 'BAD_REQUEST' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
