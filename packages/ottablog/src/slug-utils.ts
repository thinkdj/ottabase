/**
 * Shared slug utilities for ottablog models.
 *
 * Provides normalizeSlugInput and resolveUniqueSlug to avoid duplication
 * across PostTag, PostCategory, and PostSeries models.
 */
import { BaseModel } from '@ottabase/ottaorm';
import { generateSlug } from './types';

/**
 * Normalize an unknown slug input into a valid slug string.
 * Falls back to `fallback`, then to `{prefix}-{uuid}` if everything else is empty.
 */
export function normalizeSlugInput(value: unknown, fallback: string, prefix: string): string {
    const candidate = typeof value === 'string' ? value : String(value ?? '');
    const normalized = generateSlug(candidate);
    if (normalized) return normalized;
    return generateSlug(fallback) || `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Scope fields used when checking slug uniqueness. */
export interface SlugScope {
    appId: string;
    type?: string;
    excludeId?: string;
    /** Optional DB driver for multi-connection / multi-tenant scenarios. */
    driver?: any;
}

/**
 * Resolve a unique slug within a scope by appending numeric suffixes.
 * Uses `Model.first()` to check existence. Tries up to 50 numeric suffixes,
 * then falls back to a UUID suffix.
 */
export async function resolveUniqueSlug(Model: typeof BaseModel, baseSlug: string, scope: SlugScope): Promise<string> {
    // Build query scope: always appId, optionally type
    const queryScope: Record<string, unknown> = { appId: scope.appId };
    if (scope.type) queryScope.type = scope.type;

    let attempt = 0;
    let candidate = baseSlug;

    while (attempt < 50) {
        // Forward driver so uniqueness checks run against the correct DB connection
        const existing = await Model.first({ ...queryScope, slug: candidate }, scope.driver);
        if (!existing || (scope.excludeId && existing.get('id') === scope.excludeId)) {
            return candidate;
        }
        attempt += 1;
        candidate = `${baseSlug}-${attempt}`;
    }

    return `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
}

// ==================== Lifecycle config ====================

/**
 * Configuration for slug-aware create/update lifecycle hooks.
 *
 * @param slugPrefix - Fallback prefix for UUID-based slugs (e.g. 'tag', 'category', 'series')
 * @param nameField - The field used as a human-readable source for the slug (e.g. 'name', 'title')
 * @param hasType - Whether the model uses a `type` column for scoping (PostTag/PostCategory: true, PostSeries: false)
 * @param entityLabel - Human-readable label for error messages (e.g. 'post_tags', 'categories', 'series')
 */
export interface SlugLifecycleConfig {
    slugPrefix: string;
    nameField: string;
    hasType: boolean;
    entityLabel: string;
}

/**
 * Prepare slug-related fields on `data` before a `create` call.
 * Validates appId, normalizes slug, and resolves uniqueness.
 */
export async function prepareCreateSlug(
    Model: typeof BaseModel,
    data: Record<string, any>,
    config: SlugLifecycleConfig,
    driver?: any,
): Promise<void> {
    const appId = data.appId as string | undefined;
    if (!appId) {
        throw new Error(`appId is required for ${config.entityLabel}`);
    }

    const type = config.hasType ? (data.type as string | undefined) || 'post' : undefined;
    const nameValue = data[config.nameField] ?? config.slugPrefix;
    const slugBase = normalizeSlugInput(data.slug ?? nameValue, nameValue, config.slugPrefix);

    data.slug = await resolveUniqueSlug(Model, slugBase, { appId, type, driver });
    if (config.hasType) {
        data.type = type;
    }
}

/**
 * Prepare slug-related fields on `data` before an `update` call.
 * Reads current record, validates appId, normalizes slug, and resolves uniqueness.
 */
export async function prepareUpdateSlug(
    Model: typeof BaseModel,
    id: string | number,
    data: Record<string, any>,
    config: SlugLifecycleConfig,
    driver?: any,
): Promise<void> {
    const current = await Model.find(id, driver);
    if (!current) return;

    const currentAppId = current.get('appId') as string | null;
    if (!currentAppId) {
        throw new Error(`appId is required for ${config.entityLabel}`);
    }

    // Determine scope type (if model uses type column)
    const currentType = config.hasType ? (current.get('type') as string | null) || 'post' : undefined;
    const nextType = config.hasType ? (data.type as string | undefined) || currentType : undefined;

    // Determine slug source: explicit slug > new name when no current slug > current slug
    const currentName = current.get(config.nameField) as string | undefined;
    const newName = data[config.nameField] as string | undefined;
    const slugInput =
        data.slug ?? (typeof newName === 'string' && !current.get('slug') ? newName : (current.get('slug') as string));
    const slugBase = normalizeSlugInput(slugInput, newName ?? currentName ?? config.slugPrefix, config.slugPrefix);

    data.slug = await resolveUniqueSlug(Model, slugBase, {
        appId: currentAppId,
        type: nextType,
        excludeId: String(id),
        driver,
    });
    if (config.hasType) {
        data.type = nextType;
    }
}
