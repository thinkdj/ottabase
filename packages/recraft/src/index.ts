// ============================================================
// @ottabase/recraft — AI-Powered Brand Asset Generation
// ============================================================
// Recraft.ai-style creative engine with persistent style sets,
// built-in presets, and multi-provider AI image generation.
// ============================================================

// ── Models ──────────────────────────────────────────────────
export { RecraftSet, recraftSetsTable } from './ottaorm-models/RecraftSet';
export type { RecraftSetRecord, NewRecraftSetRecord, SetSettings } from './ottaorm-models/RecraftSet';

export { RecraftGeneration, recraftGenerationsTable } from './ottaorm-models/RecraftGeneration';
export type { RecraftGenerationRecord, NewRecraftGenerationRecord } from './ottaorm-models/RecraftGeneration';

export { RecraftStylePreset, recraftStylePresetsTable } from './ottaorm-models/RecraftStylePreset';
export type {
    RecraftStylePresetRecord,
    NewRecraftStylePresetRecord,
    StyleConfig,
} from './ottaorm-models/RecraftStylePreset';

// ── Presets ─────────────────────────────────────────────────
export { BUILT_IN_PRESETS, getBuiltInPreset, getPresetSlugs, getPresetsByCategory } from './presets';
export type { BuiltInPreset } from './presets';

// ── AI Providers ────────────────────────────────────────────
export {
    registerProvider,
    getProvider,
    getDefaultProvider,
    listProviders,
    generateImage,
} from './ai/provider';
export { createCloudflareAIProvider, CF_MODELS } from './ai/cloudflare-workers-ai';
export type { CFModelKey } from './ai/cloudflare-workers-ai';
export { createAIGatewayProvider } from './ai/cloudflare-ai-gateway';
export type { AIGatewayConfig } from './ai/cloudflare-ai-gateway';

// ── Handlers ────────────────────────────────────────────────
export { handleRecraftApi } from './handlers/recraft-api';
export type { RecraftRouteContext, RecraftEnv } from './handlers/types';

// ── Types ───────────────────────────────────────────────────
export {
    ASSET_TYPES,
    GENERATION_STATUSES,
    PRESET_CATEGORIES,
    IMAGE_DIMENSIONS,
} from './types';
export type {
    AssetType,
    GenerationStatus,
    PresetCategory,
    ImageDimensionKey,
    GenerateImageRequest,
    GenerateImageResult,
    AIImageProvider,
    ImageGenerationParams,
    ImageGenerationOutput,
} from './types';
