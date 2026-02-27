// ============================================================
// WORKER CONFIG ACCESSOR
// ============================================================
// Single import point for worker/server code to read config
// values that live in `ottabase.config.ts`.
//
// These are BUILD-TIME constants bundled into the Worker by
// wrangler.  They are NOT read from env vars at runtime.
//
// Env vars should only be used for:
//   - Secrets (API keys, OAuth secrets, JWT secrets)
//   - Infra IDs (DB IDs, KV namespace IDs, account IDs)
//   - Operational kill-switches (KILLSWITCH_* vars)
//   - Deployment flags (MIGRATION_ALLOW_DESTRUCTIVE)
//
// Everything else goes here via ottabase.config.ts.
// ============================================================

import type { OttabaseUserConfig } from '@ottabase/config';
import userConfig from '../../ottabase.config';

const cfg = userConfig as OttabaseUserConfig;

// ── App identity ──────────────────────────────────────────────
/** Unique app ID used in brand kits, org provisioning, headers */
export const APP_ID: string = cfg.appId;

/** Human-readable app name */
export const APP_NAME: string = cfg.appName;

// ── Email (non-secret settings) ───────────────────────────────
/**
 * Default "From" address for outbound emails.
 * The secret credentials (API key, SMTP password) still come from env vars.
 */
export const EMAIL_FROM_DEFAULT: string = cfg.email?.from ?? 'noreply@example.com';

/**
 * AWS region for SES emails.
 * Not a secret – it's a regional preference.
 */
export const EMAIL_SES_REGION: string = cfg.email?.sesRegion ?? 'us-east-1';

// ── Auth behaviour (non-secret flags) ─────────────────────────
/**
 * Session cookie max-age in seconds.
 * Default: 2_592_000 (30 days)
 */
export const AUTH_SESSION_MAX_AGE: number = cfg.features?.authBehavior?.sessionMaxAge ?? 30 * 24 * 60 * 60;

/**
 * When true, users must verify their email before they can log in.
 * Default: false
 */
export const AUTH_REQUIRE_EMAIL_VERIFIED: boolean = cfg.features?.authBehavior?.requireEmailVerified ?? false;

/**
 * When true, credentials (email/password) login is disabled.
 * Only OAuth providers will be available.
 * Default: false
 */
export const AUTH_DISABLE_CREDENTIALS: boolean = cfg.features?.authBehavior?.disableCredentials ?? false;

/**
 * Enable verbose auth logging.
 * Default: false
 */
export const AUTH_VERBOSE: boolean = cfg.features?.authBehavior?.verbose ?? false;

// ── Package toggles ──────────────────────────────────────────
/** Built-in package enabled/disabled flags from ottabase.config.ts */
export const PACKAGES = {
    ottablog: cfg.packages?.ottablog ?? false,
    shortlinks: cfg.packages?.shortlinks ?? false,
    referrals: cfg.packages?.referrals ?? false,
    brandEngine: cfg.packages?.brandEngine ?? false,
} as const;
