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
