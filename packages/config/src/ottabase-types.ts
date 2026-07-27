// ============================================================
// Ottabase Config Types — Dynamic package & feature configuration
// ============================================================
// Used by defineOttabaseConfig() for single-source-of-truth config
// that drives: migrations, routes, features, and UI.
// ============================================================

export interface OttabaseMeta {
    description?: string;
    author?: string;
    keywords?: string;
    companyName?: string;
    /** Logo URL (default: '/logo.png') */
    logoUrl?: string;
    /** Page title (default: appName) */
    title?: string;
    /** Robots directive (default: 'index, follow') */
    robots?: string;
    /**
     * Short line shown beside the app name in the header — an edition or positioning
     * phrase ('Beta', 'Cloudflare-native'). Empty hides it. Keep it to roughly two
     * words; the header renders it uppercase.
     */
    tagline?: string;
}

export interface ReferralsFeatureConfig {
    enabled: boolean;
    trackClicks: boolean;
    expiryDays: number;
    /**
     * URL query-param key that carries an inbound referral code, e.g. `ref` in
     * `https://app.example.com/?ref=johndoe`. Change it to rebrand share links
     * (`?invite=`, `?r=`, …). Overridable per deploy via the REFERRAL_PARAM env var.
     * Default: `ref`.
     */
    referralParam: string;
}

/** Default inbound referral query-param key. */
export const DEFAULT_REFERRAL_PARAM = 'ref';

/**
 * Normalize a referral param key to something URL-safe. A query-param name with
 * spaces/`=`/`&`/`?`/`#` would break link building and parsing, so anything that
 * isn't a letter, digit, underscore, or hyphen falls back to the default.
 */
export function normalizeReferralParam(value: string | undefined | null): string {
    if (typeof value !== 'string') return DEFAULT_REFERRAL_PARAM;
    const trimmed = value.trim();
    return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : DEFAULT_REFERRAL_PARAM;
}

export interface SpotlightFeatureConfig {
    enabled: boolean;
    shortcuts: string[];
}

export interface PaginationFeatureConfig {
    defaultPageSize: number;
    maxPageSize: number;
    sizeOptions: number[];
}

export interface CrudHubFeatureConfig {
    apiBaseUrl: string;
    urlBase: string;
    urlBaseListing: 'list' | 'browse';
}

export interface AuthBehaviorConfig {
    sessionMaxAge: number;
    requireEmailVerified: boolean;
    disableCredentials: boolean;
    verbose: boolean;
}

/**
 * Blog tenancy mode.
 * - 'platform' (default): one blog per app, owned by the platform. Today's behavior, unchanged.
 * - 'org': each organization gets its own blog namespace — org-scoped slugs, taxonomy, and theme.
 *   Rows with a null organizationId remain platform-owned content.
 */
export type OttablogMode = 'platform' | 'org';

export interface OttablogFeatureConfig {
    mode: OttablogMode;
}

/**
 * Per-minute inference call ceilings. Every value is calls-per-minute; `0` disables that
 * dimension (it does NOT mean "block everything").
 */
export interface OttaaiRateLimitConfig {
    /** Per authenticated user, within this app. `0` disables. */
    perUser: number;
    /** Per organization, within this app. Skipped when the caller has no active org. `0` disables. */
    perOrganization: number;
    /**
     * App-wide ceiling across every user and org.
     *
     * MUST BE POSITIVE WHENEVER PLATFORM-PAID INFERENCE IS REACHABLE. It is the only
     * AGGREGATE limit — `perUser` and `perOrganization` each bound one actor and say nothing
     * about the total — so `0` here does not merely disable a dimension, it removes the only
     * cap on what the operator can spend. A deployment that can bill the operator and sets
     * `perApp <= 0` has its platform calls REFUSED rather than left uncapped; set a large
     * number instead of 0 if you intend a high cap.
     */
    perApp: number;
}

/**
 * AI provisioning dials (@ottabase/ottaai). Non-secret only — the master secret, the
 * gateway token and every platform provider key stay in env vars.
 *
 * FROZEN AT MAJOR and logged once at boot: changing the default strategy or mode in a
 * minor silently re-points which key a tenant's calls use, with no error and no diff a
 * consumer would notice.
 */
export interface OttaaiFeatureConfig {
    /** Where a key may come from. `auto` = platform floor with a tenant upgrade. */
    mode: 'platform' | 'auto' | 'byok';
    /**
     * Whose key outranks whose. B2C ⇒ `user-then-org`; B2B/shared workspace ⇒ `org-then-user`.
     * A task may NARROW `mode`, but may never override `strategy`.
     */
    strategy: 'user' | 'org' | 'user-then-org' | 'org-then-user';
    /** App-dimension matching. `strict` is the only safe FIRST configuration. */
    appScope: 'strict' | 'wildcard';
    /**
     * The kill switch. `false` rewrites every task to `platform` and downgrades every
     * `required` gate to `soft` — deliberately NOT expressed as `mode`, which would make
     * a gated task a boot error instead of a graceful degradation.
     */
    byokEnabled: boolean;
    /** Whether tenants may save a key for the whole organisation (needs `ai:manage`). */
    allowOrgCredentials: boolean;
    /**
     * Inference rate limits, in calls per minute, consumed on EVERY dimension at once.
     *
     * NOT A BILLING QUOTA. It bounds burst and abuse; it does not bound total spend. Real
     * spend accounting needs a strongly consistent counter and a commercial policy (free
     * tier, reset period, refunds, admin overrides) and is deliberately not attempted here —
     * an approximate KV count is not a billing boundary.
     *
     * THREE DIMENSIONS, because one is never enough: `perUser` stops a single account
     * looping, `perOrganization` stops a workspace fanning the same abuse across seats, and
     * `perApp` is the aggregate ceiling across every account.
     *
     * BEST-EFFORT, NOT A HARD BOUND. The counters are eventually consistent, so the effective
     * ceiling is roughly the configured limit plus the in-flight concurrency count. A hard
     * global budget needs a strongly consistent coordinator (a Durable Object); this is a
     * burst control, and describing it as "the most the operator can be billed" would be a
     * guarantee it does not make.
     */
    rateLimit: OttaaiRateLimitConfig;
    /** Cloudflare AI Gateway slug. Overridable per deploy via `CFAI_GATEWAY_NAME`. */
    gateway: string | null;
    /** The provider the PLATFORM key belongs to. Declared, never inferred from a prefix. */
    platformProvider: string | null;
    /** Platform default model. A `dynamic/<route>` ref is recommended. */
    platformModel: string | null;
}

export interface OttabaseFeaturesConfig {
    referrals?: ReferralsFeatureConfig;
    spotlight?: SpotlightFeatureConfig;
    pagination?: PaginationFeatureConfig;
    crudHub?: CrudHubFeatureConfig;
    authBehavior?: AuthBehaviorConfig;
    ottablog?: Partial<OttablogFeatureConfig>;
    /**
     * `rateLimit` is separately partial so an operator can override ONE dimension without
     * restating the other two — a plain `Partial<OttaaiFeatureConfig>` would demand all three.
     */
    ottaai?: Partial<Omit<OttaaiFeatureConfig, 'rateLimit'>> & { rateLimit?: Partial<OttaaiRateLimitConfig> };
}

export interface OttabaseEmailConfig {
    from: string;
    sesRegion?: string;
}

export interface OttabaseUIConfig {
    preventFOUC?: boolean;
    preventFOUCInsideIframe?: boolean;
    debounceMs?: number;
    layout?: { minWidth: number; maxWidth: number };
    enforceGoogleFonts?: boolean;
}

/**
 * Sentinel value for the x-org-id header / org selection meaning "act in PLATFORM
 * scope" (organizationId NULL — platform-owned rows such as the platform's own
 * blog in org mode). Honored server-side only for platform admins; never a valid
 * organization id. Shared by the API client, the org switcher, and the worker.
 */
export const PLATFORM_ORG_SENTINEL = 'platform';

/** Built-in package keys. Extend when adding new built-in packages. brandEngine is core, not a package. */
export const BUILT_IN_PACKAGES = ['comments', 'ottablog', 'ottaai', 'referrals', 'shortlinks'] as const;

export type BuiltInPackageName = (typeof BUILT_IN_PACKAGES)[number];

/** Custom package config: maps package key to its table definitions (for migrations). */
export interface CustomPackageConfig {
    tables: Record<string, unknown>;
    migrations?: unknown[];
}

/** User input for defineOttabaseConfig — partial, with optional packages. */
export interface OttabaseConfigInput {
    appId: string;
    appName: string;
    meta?: OttabaseMeta;
    storage?: { prefix?: string };
    packages?: Partial<Record<BuiltInPackageName, boolean>>;
    customPackages?: Record<string, CustomPackageConfig>;
    features?: OttabaseFeaturesConfig;
    email?: OttabaseEmailConfig;
    ui?: OttabaseUIConfig;
}

/** Resolved full config — all optional fields have defaults. */
export interface OttabaseConfig {
    appId: string;
    appName: string;
    meta: {
        description: string;
        author: string;
        keywords: string;
        companyName: string;
        logoUrl: string;
        title: string;
        robots: string;
        tagline: string;
    };
    storage: { prefix: string };
    packages: Record<BuiltInPackageName, boolean>;
    customPackages: Record<string, CustomPackageConfig>;
    features: {
        referrals: ReferralsFeatureConfig;
        spotlight: SpotlightFeatureConfig;
        pagination: PaginationFeatureConfig;
        crudHub: CrudHubFeatureConfig;
        authBehavior: AuthBehaviorConfig;
        ottablog: OttablogFeatureConfig;
        ottaai: OttaaiFeatureConfig;
    };
    email: OttabaseEmailConfig;
    ui: OttabaseUIConfig;
}
