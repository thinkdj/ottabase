// ============================================================
// OTTABASE USER CONFIG  —  EXAMPLE / TEMPLATE
// ============================================================
//
// FIRST-TIME SETUP
// ─────────────────
// Copy this file to create your own config:
//   cp ottabase.config.example.ts ottabase.config.ts
//
// ottabase.config.ts is gitignored — your customisations are
// never overwritten by `git pull` or zip-replace.
//
// HOW UPDATES WORK
// ─────────────────
// 1. Pull the latest framework:
//      git pull upstream main          (fork) OR
//      unzip ottabase-latest.zip -d . (zip download)
// 2. Your ottabase.config.ts is untouched (gitignored).
// 3. Run `pnpm install && pnpm build:pkg && pnpm dev`.
//
// PREMIUM / CUSTOM PACKAGES
// ──────────────────────────
// Install the package, then:
//   1. Register tables in  ottabase/config.migrations.ts
//   2. Register routes in  ottabase/config.routes.ts
//   3. Add the key to `customPackages` below.
// Table/route imports are server-only so client bundles stay lean.
//
// VALIDATION
// ──────────
// defineOttabaseConfig() validates at startup:
//   • Throws on missing required fields (appId, appName).
//   • Warns on unrecognised keys (likely typos) so they
//     don't silently fall to defaults.
// ============================================================

import { defineOttabaseConfig } from '@ottabase/config';

export default defineOttabaseConfig({
    // ── App Identity ──────────────────────────────────────────
    appId: 'ottabase-template-app',
    appName: 'Ottabase Template App (TanStack)',

    // ── App Metadata (SEO, copyright, social) ─────────────────
    meta: {
        description: 'A minimal TanStack + Cloudflare Workers template app in the Ottabase monorepo',
        author: '@thinkdj',
        keywords:
            'Ottabase, TanStack Router, TanStack Query, Vite, Tailwind, Shadcn, Cloudflare Workers, TypeScript, React',
        companyName: 'Ottabase',
    },

    // ── Theme ─────────────────────────────────────────────────
    theme: {
        colorDefault: 'tremorBlue',
    },

    // ── Storage ───────────────────────────────────────────────
    storage: {
        prefix: 'ottabase',
    },

    // ── Built-in Package Toggles ──────────────────────────────
    // Set a package to `false` (or remove it) to exclude its
    // database tables and API routes from your app.
    packages: {
        ottablog: true,
        shortlinks: true,
        referrals: true,
        brandEngine: true,
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
