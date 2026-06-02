// ============================================================
// Payport — Plan Definition & Resolver
// ============================================================
//
// Apps define their plans ONCE here, and Payport handles the
// mapping to provider product ids. The DB-backed `PaymentPlan`
// model is the canonical mapping; this file is the in-memory
// catalog the app boots with.
// ============================================================

import type { PaymentProviderName, PlanDTO } from '../types';

export interface PlanDefinition {
    slug: string;
    name: string;
    /** Map of provider -> external product id. Plans MAY be incomplete across providers. */
    providerProductIds: Partial<Record<PaymentProviderName, string>>;
    features: string[];
    priceLabel?: string;
    /** Optional human-readable description for pricing pages. */
    description?: string | null;
    /** Numeric pricing (minor units / cents). */
    priceMonthly?: number | null;
    priceYearly?: number | null;
    currency?: string;
    /** Sort key for pricing pages and admin lists. */
    displayOrder?: number;
    /** Auto-assigned to new users when no subscription is active. */
    isDefault?: boolean;
    /** Marketing visibility. */
    isPublic?: boolean;
    metadata?: Record<string, unknown>;
}

export type PlanCatalog = Record<string, PlanDefinition>;

const STATE: { catalog: PlanCatalog } = { catalog: {} };

/**
 * Convenience helper for typed plan definitions:
 *
 * ```ts
 * export const plans = definePlans({
 *   free: { slug: 'free', name: 'Free', providerProductIds: {}, features: [] },
 *   pro:  { slug: 'pro',  name: 'Pro',  providerProductIds: { polar: 'prod_123' }, features: ['ai'] },
 * });
 * ```
 */
export function definePlans<T extends PlanCatalog>(catalog: T): T {
    return catalog;
}

/** Register a catalog (idempotent — last call wins). */
export function registerPlans(catalog: PlanCatalog): void {
    STATE.catalog = { ...catalog };
}

export function getPlanCatalog(): PlanCatalog {
    return STATE.catalog;
}

export function resolvePlanBySlug(slug: string): PlanDefinition | null {
    return STATE.catalog[slug] ?? null;
}

export function resolvePlanByProviderProduct(
    provider: PaymentProviderName,
    externalProductId: string,
): PlanDefinition | null {
    for (const plan of Object.values(STATE.catalog)) {
        if (plan.providerProductIds[provider] === externalProductId) return plan;
    }
    return null;
}

export function toPlanDTO(plan: PlanDefinition, provider: PaymentProviderName): PlanDTO {
    const externalProductId = plan.providerProductIds[provider];
    if (!externalProductId) {
        throw new Error(`[payport] Plan "${plan.slug}" has no product id for provider "${provider}".`);
    }
    return {
        id: plan.slug,
        slug: plan.slug,
        name: plan.name,
        provider,
        providerProductId: externalProductId,
        features: plan.features,
        priceLabel: plan.priceLabel ?? null,
        metadata: plan.metadata ?? null,
    };
}

// ============================================================
// DB-backed catalog: load + seed
// ============================================================
//
// `paymentPlansTable` is the canonical store admins edit. On boot
// we hydrate STATE.catalog from the DB so `resolvePlanBySlug` (sync,
// hot path used inside checkout) keeps working without round-trips.
//
// Multi-provider: rows are keyed by `(slug, provider)`. We group by
// slug and merge provider product ids into a single PlanDefinition.

let LOADED_FROM_DB = false;

interface PlanRow {
    get(key: string): unknown;
}

function rowToFeatures(row: PlanRow): string[] {
    const raw = row.get('features');
    if (Array.isArray(raw)) return raw.filter((f): f is string => typeof f === 'string');
    if (typeof raw !== 'string' || !raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((f): f is string => typeof f === 'string') : [];
    } catch {
        return [];
    }
}

function rowToMetadata(row: PlanRow): Record<string, unknown> | undefined {
    const raw = row.get('metadata');
    if (!raw || typeof raw !== 'string') return undefined;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Load the active plan catalog from the DB and replace the in-memory STATE.
 * Rows sharing a slug are merged: their provider product ids fold into a
 * single `providerProductIds` map. Empty strings (free-plan placeholder)
 * are skipped so they don't surface as fake provider mappings.
 */
export async function loadPlansFromDb(): Promise<PlanCatalog> {
    const { PaymentPlan } = await import('../models');
    const rows = (await PaymentPlan.where({ active: true })) as PlanRow[];

    const catalog: PlanCatalog = {};
    for (const row of rows) {
        const slug = row.get('slug') as string | null;
        if (!slug) continue;

        // 'none' is a valid stored value for free plans that have no payment
        // provider wired. It must not be treated as a PaymentProviderName so
        // it doesn't pollute the providerProductIds map.
        const provider = row.get('provider') as PaymentProviderName | 'none' | null;
        const productId = row.get('providerProductId') as string | null;

        const existing = catalog[slug];
        const providerProductIds: Partial<Record<PaymentProviderName, string>> = existing?.providerProductIds ?? {};
        if (provider && provider !== 'none' && productId) providerProductIds[provider] = productId;

        catalog[slug] = {
            slug,
            name: (row.get('name') as string) ?? slug,
            description: (row.get('description') as string | null) ?? null,
            providerProductIds,
            features: existing?.features ?? rowToFeatures(row),
            priceLabel: (row.get('priceLabel') as string | null) ?? undefined,
            priceMonthly: (row.get('priceMonthly') as number | null) ?? null,
            priceYearly: (row.get('priceYearly') as number | null) ?? null,
            currency: (row.get('currency') as string | null) ?? 'USD',
            displayOrder: Number(row.get('displayOrder') ?? 0),
            isDefault: Boolean(row.get('isDefault')),
            isPublic: row.get('isPublic') === undefined ? true : Boolean(row.get('isPublic')),
            metadata: existing?.metadata ?? rowToMetadata(row),
        };
    }

    STATE.catalog = catalog;
    LOADED_FROM_DB = true;
    return catalog;
}

/**
 * Idempotent: ensures STATE.catalog has been hydrated from the DB at least
 * once for the current isolate. Call from request handlers that depend on
 * `resolvePlanBySlug` to be in sync with admin edits.
 */
export async function ensurePlansLoaded(): Promise<PlanCatalog> {
    if (LOADED_FROM_DB) return STATE.catalog;
    return loadPlansFromDb();
}

/** Force a re-read from the DB (e.g. after admin edits). */
export async function refreshPlans(): Promise<PlanCatalog> {
    return loadPlansFromDb();
}

export interface SeedPlanInput extends Omit<PlanDefinition, 'providerProductIds'> {
    /** Provider key to write the row under. Use 'none' (or omit) for free plans with no provider. */
    provider?: PaymentProviderName | 'none';
    providerProductId?: string;
}

/**
 * Insert default plans into the DB on first boot. Idempotent — only writes
 * if the table is empty. Designed for use inside `bootstrapPayport` so a
 * fresh install lights up the admin Plans page without any manual SQL.
 */
export async function seedPlansIfEmpty(plans: SeedPlanInput[]): Promise<{ seeded: number }> {
    if (plans.length === 0) return { seeded: 0 };
    const { PaymentPlan } = await import('../models');
    const existing = (await PaymentPlan.all()) as PlanRow[];
    if (existing.length > 0) return { seeded: 0 };

    let seeded = 0;
    for (const plan of plans) {
        await PaymentPlan.create({
            slug: plan.slug,
            name: plan.name,
            description: plan.description ?? null,
            provider: plan.provider && plan.provider !== 'none' ? plan.provider : 'none',
            providerProductId: plan.providerProductId ?? '',
            features: JSON.stringify(plan.features ?? []),
            priceLabel: plan.priceLabel ?? null,
            priceMonthly: plan.priceMonthly ?? 0,
            priceYearly: plan.priceYearly ?? 0,
            currency: plan.currency ?? 'USD',
            displayOrder: plan.displayOrder ?? seeded,
            isDefault: plan.isDefault ?? false,
            isPublic: plan.isPublic ?? true,
            metadata: plan.metadata ? JSON.stringify(plan.metadata) : null,
            active: true,
        });
        seeded++;
    }
    return { seeded };
}
