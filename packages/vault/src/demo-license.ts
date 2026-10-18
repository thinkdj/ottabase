// ============================================================
// DEMO LICENSING MATERIAL — PUBLISHED ON PURPOSE, NOT A SECRET
// ============================================================
// Vault ships in the public repository with its demo keypair and a "pro" license printed
// below, like `@ottabase/premium-webhooks`. Anyone can mint a license for `vault`; that is
// the point: the whole activation flow (unlicensed → pasted key → nightly schedule running)
// can be tried without buying anything.
//
// WHAT A VENDOR SELLING THIS DOES INSTEAD:
//   • generates its own keypair with `generateLicenseKeypair()` from
//     `@ottabase/premium/license-tools`,
//   • passes ONLY the public key as `licensePublicKey` to `createVaultPackage`,
//   • keeps the private key with release signing material — never in the repo, never in
//     the app, never in an env var the app can read.
// ============================================================

/** Public key for the demo vendor. Verification material — safe by design. */
export const DEMO_LICENSE_PUBLIC_KEY =
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE5zVE97BmCfxte2V57fiL25zBGM2C4SfaGH4sOVvx2hyFGe_bmtEbaeM9b9ghvzZgCYGPgco9Zv-9RPrbj0ddpw';

/** DEMO PRIVATE KEY. Published deliberately (see the header) so you can mint test licenses. */
export const DEMO_LICENSE_PRIVATE_KEY =
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQglN3txLVDCJYDKEWV6RVfT_S3KVm0w2ZAOLMAIIpaE9uhRANCAATnNUT3sGYJ_G17ZXnt-IvbnMEYzYLhJ9oYfiw5W_HaHIUZ79ua0Rtp4z1v2CG_NmAJgY-Byj1m_71E-tuPR12n';

/**
 * A perpetual "pro" license for the demo vendor: the nightly schedule, tenant export, and
 * up to 365 kept backups. Paste it at Admin → Growth → Premium packages, or set
 * `PREMIUM_LICENSE_VAULT` to it. Perpetual (no `exp`) on purpose: a dated demo key would
 * silently start failing for everyone who cloned the repo after that date.
 */
export const DEMO_PRO_LICENSE =
    'otta_premium_v1.eyJpZCI6ImxpY19kZW1vX3ZhdWx0XzAwMDEiLCJwa2ciOiJ2YXVsdCIsInBsYW4iOiJwcm8iLCJsaWNlbnNlZSI6Ik90dGFiYXNlIERlbW8iLCJmZWF0dXJlcyI6WyJzY2hlZHVsZSIsImV4cG9ydCJdLCJsaW1pdHMiOnsiYmFja3VwcyI6MzY1fSwiaWF0IjoxNzM1Njg5NjAwfQ.NYALUWEwyMpQVQb6p0KtE6AcoEKhAr2geoR2EsQd5lTciMpxyG9MdXf8ZjhSQJSwiWTfvkmcdt_zrVJpd70FUw';
