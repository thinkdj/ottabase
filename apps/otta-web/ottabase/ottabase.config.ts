// ============================================================
// OTTABASE USER CONFIG  —  Single source for per-app settings
// ============================================================
//
// Precedence: ENV VAR >> this file >> default
// Secrets (AUTH_SECRET, OAuth keys, API keys) = env only, never here.
//
// PREMIUM / CUSTOM PACKAGES:
//   1. Register tables in  ottabase/config.migrations.ts
//   2. Register routes in  ottabase/config.routes.ts
//   3. Add the key to `customPackages` below.
// ============================================================

import { defineOttabaseConfig } from '@ottabase/config';

export default defineOttabaseConfig({
    // ── App Identity ──────────────────────────────────────────
    appId: 'otta-web',
    appName: 'Ottabase Template App',

    // ── App Metadata (SEO, copyright, social) ─────────────────
    meta: {
        // Short line beside the app name in the header — say what the app IS, not what it is built with
        tagline: 'Cloudflare-native',
        description: 'A minimal Vite + Cloudflare Workers template app in the Ottabase monorepo',
        author: '@thinkdj',
        keywords:
            'Ottabase, TanStack Router, TanStack Query, Vite, Tailwind, Shadcn, Cloudflare Workers, TypeScript, React',
        companyName: 'Ottabase',
    },

    // ── Storage ───────────────────────────────────────────────
    storage: {
        prefix: 'ottabase',
    },

    // ── Built-in Package Toggles ──────────────────────────────
    // Set a package to `false` (or remove it) to exclude its
    // database tables and API routes from your app.
    // brandEngine is core — always enabled, not configurable.
    packages: {
        comments: true,
        ottablog: true,
        shortlinks: true,
        referrals: true,
        // AI provisioning / BYOK. Dormant until AI_CREDENTIAL_SECRET is set — the routes,
        // the table and the settings UI all stay off, so the app boots and serves fine
        // without any AI configuration at all.
        ottaai: true,
    },

    // ── Custom / Premium Packages ─────────────────────────────
    // After installing a premium package:
    //   1. Register tables in  ottabase/config.migrations.ts
    //   2. Register routes in  ottabase/config.routes.ts
    //   3. Add the key here:
    //
    // Example:
    //   customPackages: {
    //     myPremiumFeature: { tables: { premiumTable } },
    //   },
    customPackages: {},

    // ── Feature Configuration ─────────────────────────────────
    features: {
        referrals: {
            enabled: true,
            trackClicks: true,
            expiryDays: 90,
            // URL query-param key for inbound referral links (e.g. ?ref=johndoe).
            // Change it to rebrand share links (?invite=, ?r=, …); the tracker,
            // URL cleanup, and dashboard share links all follow this value.
            // Also overridable per deploy via the REFERRAL_PARAM env var.
            referralParam: 'ref',
        },
        spotlight: {
            enabled: true,
            shortcuts: ['/'],
        },
        pagination: {
            defaultPageSize: 10,
            maxPageSize: 100,
            sizeOptions: [5, 10, 20, 50, 100],
        },
        crudHub: {
            apiBaseUrl: '/api/crudhub',
            urlBase: 'crudhub',
            urlBaseListing: 'browse',
        },
        // ── AI provisioning / BYOK (non-secret dials) ──────────
        // Secrets stay in env: AI_CREDENTIAL_SECRET (or AI_CREDENTIAL_KEYRING +
        // AI_CREDENTIAL_KEY_ID for rotation), CFAI_GATEWAY_TOKEN, CFAI_<PROVIDER>_API_KEY.
        // These dials are FROZEN AT MAJOR and logged once at boot — changing mode or
        // strategy silently re-points which key a tenant's calls use.
        ottaai: {
            // 'auto' = platform floor with a tenant upgrade — what makes a free tier viable.
            mode: 'auto',
            // B2C default. Use 'org-then-user' for a shared-workspace/B2B product.
            strategy: 'user-then-org',
            // The only safe FIRST configuration: turning app scoping on later orphans
            // every pre-existing row, silently, with an empty result.
            appScope: 'strict',
            // The kill switch. false ⇒ every task runs on the platform and every
            // 'required' gate degrades to 'soft'. NOT expressed as mode, on purpose.
            byokEnabled: true,
            // Org-wide keys need the ai:manage permission (owner/admin hold it).
            allowOrgCredentials: true,
            // Inference calls per minute, checked on ALL THREE dimensions before any is
            // charged. Best-effort burst control, NOT a billing quota — the counters are
            // eventually consistent, so the effective ceiling is roughly the limit plus the
            // in-flight concurrency count.
            //
            // It matters most when `platformProvider` is set below: without it, any
            // authenticated user can loop `/api/ai/complete` on the operator's key.
            // `perUser`/`perOrganization` may be 0 to disable them. `perApp` may NOT — it is
            // the only AGGREGATE limit, so a deployment that can bill the operator and sets
            // it to 0 has its platform calls refused. Use a large number for a high cap.
            rateLimit: { perUser: 20, perOrganization: 120, perApp: 600 },
            // Platform floor. Leave null to ship BYOK-only (every gate becomes the upsell).
            platformProvider: null,
            platformModel: null,
        },

        // ── Auth behaviour (non-secret flags) ──────────────────
        // These replace the AUTH_SESSION_MAX_AGE, AUTH_REQUIRE_EMAIL_VERIFIED,
        // AUTH_DISABLE_CREDENTIALS, and AUTH_VERBOSE env vars.
        // Secrets (AUTH_SECRET, OAuth credentials) still go in env vars.
        authBehavior: {
            sessionMaxAge: 30 * 24 * 60 * 60, // 30 days in seconds
            requireEmailVerified: false,
            disableCredentials: false,
            verbose: false,
        },
    },

    // ── Email (non-secret settings) ───────────────────────────
    // Replaces EMAIL_FROM and AWS_REGION env vars.
    // Secrets (EMAIL_RESEND_API_KEY, AWS_ACCESS_KEY_ID, etc.) stay in env vars.
    email: {
        from: 'noreply@example.com', // Change to your domain: noreply@yourdomain.com
        sesRegion: 'us-east-1', // AWS SES region (only needed when using SES)
    },

    // ── UI ────────────────────────────────────────────────────
    ui: {
        preventFOUC: false,
        preventFOUCInsideIframe: false,
        debounceMs: 500,
        layout: { minWidth: 320, maxWidth: 1280 },
        enforceGoogleFonts: true,
    },
});
