// ============================================================
// OTTABASE USER CONFIG  ←  This file is YOURS to customize.
// ============================================================
//
// This is the single file you edit when building your app on
// top of the Ottabase monorepo.  All framework files (packages/,
// worker/routes/, cloudflare-worker.ts, …) can be freely updated
// via `git pull` / zip-replace without touching this file.
//
// HOW UPDATES WORK
// ─────────────────
// 1. Pull the latest framework:
//      git pull upstream main          (fork) OR
//      unzip ottabase-latest.zip -d . (zip download)
// 2. Your customisations here are untouched.
// 3. Run `pnpm install && pnpm build:pkg && pnpm dev`.
//
// PREMIUM / CUSTOM PACKAGES
// ──────────────────────────
// Install the package, then add it to `customPackages` below.
// Tables are resolved at runtime in `ottabase/config.migrations.ts`
// (server-only) so client bundles stay lean.
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
    // After installing a premium package, add its registration
    // here AND import its tables in ottabase/config.migrations.ts.
    //
    // Example:
    //   customPackages: {
    //     myPremiumFeature: { tables: { premiumTable } },
    //   },
    //
    // (table imports live in config.migrations.ts to stay server-only)
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
