# @ottabase/config — agent notes

Type-safe app/site configuration with env-variable overrides for Ottabase apps. Full docs: ./README.md

## Use when

- Creating or reading app-level config: app meta, feature flags, built-in package toggles, storage keys, env-driven overrides.
- NOT for secrets (AUTH_SECRET, OAuth/API keys) — those must come from env only, never config files.

## Imports

    import { defineOttabaseConfig, resolveConfigWithEnv, isPackageEnabled, isCustomPackageEnabled } from '@ottabase/config';
    import { createAppConfig, createStorageKey, createThemeColors, getCurrentYear } from '@ottabase/config';
    import { BUILT_IN_PACKAGES, ENV_KEYS, STORAGE_KEYS, DEFAULT_THEME_COLORS, DEFAULT_UI_CONFIG } from '@ottabase/config';
    import type { AppConfig, OttabaseConfig, OttabaseConfigInput, EnvLike, SupportedUIFramework } from '@ottabase/config';

## Canonical usage

    // ottabase.config — single source of truth for packages/features
    const config = defineOttabaseConfig({
        appId: 'otta-web', // required
        appName: 'My App', // required
        packages: { ottablog: false }, // comments | ottablog | shortlinks | referrals
        features: { referrals: { enabled: true } },
    });

    // Per-request env overrides (Cloudflare env or process.env)
    const resolved = resolveConfigWithEnv(config, env); // ENV >> config >> default
    if (isPackageEnabled(resolved, 'ottablog')) { /* ... */ }

    // Legacy/app-shell config (reads process.env directly)
    const appConfig = createAppConfig({ appName: 'My App', appId: 'otta-web', envPrefix: '' });
    const key = createStorageKey(appConfig, STORAGE_KEYS.THEME); // 'my-app.theme'

## Gotchas

- Two config systems: `defineOttabaseConfig` + `resolveConfigWithEnv` (explicit `EnvLike`, edge-safe) vs `createAppConfig` (reads `process.env`, guarded no-op when absent — env overrides silently skipped on edge).
- `envPrefix` (e.g. `'VITE_'`) exists only on `createAppConfig`; `resolveConfigWithEnv` reads unprefixed `ENV_KEYS` from the env object you pass.
- Boolean env parsing differs: `resolveConfigWithEnv` accepts `'true'`/`'1'` (case-insensitive); `createAppConfig` accepts only `'true'`.
- `defineOttabaseConfig` throws if `appId`/`appName` missing; warns on unrecognised top-level keys.
- Package toggles override via `OTTABASE_PKG_*` env vars (see `ENV_KEYS`).
- Multi-app DB sharing: same `appId` plus `features.scopeByAppId = true` (env `SCOPE_BY_APP_ID`).
- Default spotlight shortcuts differ: `defineOttabaseConfig` defaults to `['/']`; `DEFAULT_SPOTLIGHT_CONFIG`/`createAppConfig` default to `['mod + K', ...]`.
