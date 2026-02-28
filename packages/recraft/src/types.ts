// ============================================================
// @ottabase/recraft — Shared Types
// ============================================================

export { type RecraftSetRecord, type NewRecraftSetRecord } from './ottaorm-models/RecraftSet.schema';
export { type RecraftGenerationRecord, type NewRecraftGenerationRecord } from './ottaorm-models/RecraftGeneration.schema';
export { type RecraftStylePresetRecord, type NewRecraftStylePresetRecord } from './ottaorm-models/RecraftStylePreset.schema';

// ── Asset types ─────────────────────────────────────────────

export const ASSET_TYPES = {
    logo: 'Logo',
    icon: 'Icon',
    illustration: 'Illustration',
    graphic: 'Graphic',
    creative: 'Creative',
    pattern: 'Pattern',
    'social-media': 'Social Media',
    banner: 'Banner',
} as const;

export type AssetType = keyof typeof ASSET_TYPES;

// ── Generation status ───────────────────────────────────────

export const GENERATION_STATUSES = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
} as const;

export type GenerationStatus = keyof typeof GENERATION_STATUSES;

// ── Preset categories ───────────────────────────────────────

export const PRESET_CATEGORIES = {
    illustration: 'Illustration',
    logo: 'Logo',
    icon: 'Icon',
    pattern: 'Pattern',
    photo: 'Photo-realistic',
} as const;

export type PresetCategory = keyof typeof PRESET_CATEGORIES;

// ── Image dimensions ────────────────────────────────────────

export const IMAGE_DIMENSIONS = {
    'logo-square': { width: 512, height: 512, label: 'Logo (Square)' },
    'logo-wide': { width: 768, height: 512, label: 'Logo (Wide)' },
    'icon-sm': { width: 256, height: 256, label: 'Icon (Small)' },
    'icon-md': { width: 512, height: 512, label: 'Icon (Medium)' },
    'social-square': { width: 1024, height: 1024, label: 'Social (Square)' },
    'social-story': { width: 768, height: 1024, label: 'Social (Story)' },
    'banner-wide': { width: 1024, height: 512, label: 'Banner (Wide)' },
    'creative-large': { width: 1024, height: 1024, label: 'Creative (Large)' },
} as const;

export type ImageDimensionKey = keyof typeof IMAGE_DIMENSIONS;

// ── Request / Response types ────────────────────────────────

export interface GenerateImageRequest {
    setId: string;
    prompt: string;
    negativePrompt?: string;
    assetType?: AssetType;
    width?: number;
    height?: number;
    /** Override the set's style for this generation */
    styleOverrides?: {
        guidanceScale?: number;
        steps?: number;
        model?: string;
    };
}

export interface GenerateImageResult {
    generationId: string;
    status: GenerationStatus;
    imageUrl?: string;
    metadata?: {
        width: number;
        height: number;
        model: string;
        provider: string;
        durationMs: number;
    };
    error?: string;
}

// ── AI Provider types ───────────────────────────────────────

export interface ImageGenerationParams {
    prompt: string;
    negativePrompt?: string;
    width: number;
    height: number;
    guidanceScale?: number;
    steps?: number;
    model?: string;
    seed?: number;
}

export interface ImageGenerationOutput {
    imageData: ArrayBuffer;
    format: string;
    model: string;
    provider: string;
    seed?: number;
    durationMs: number;
}

export interface AIImageProvider {
    readonly name: string;
    readonly supportedModels: string[];
    generate(params: ImageGenerationParams): Promise<ImageGenerationOutput>;
}
