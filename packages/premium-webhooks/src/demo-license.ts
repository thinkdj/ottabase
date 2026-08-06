// ============================================================
// DEMO LICENSING MATERIAL — PUBLISHED ON PURPOSE, NOT A SECRET
// ============================================================
// This package ships as the WORKED EXAMPLE for `@ottabase/premium`, so its keypair is in
// the repository and its "pro" license is printed below. Anyone can mint a license for
// `webhooks`; that is the point — you can try the whole activation flow without buying
// anything.
//
// WHAT A REAL VENDOR DOES INSTEAD:
//   • generates its own keypair with `generateLicenseKeypair()` from
//     `@ottabase/premium/license-tools`,
//   • puts ONLY the public key in the manifest,
//   • keeps the private key wherever release signing material lives — never in the repo,
//     never in the app, never in an env var the app can read.
//
// The private key below is included so you can mint your own test licenses (expired,
// app-bound, different plans) and watch each state render. Copying this pattern into a
// package you actually sell makes the licensing decorative.
// ============================================================

/** Public key for the demo vendor. Verification material — safe by design. */
export const DEMO_LICENSE_PUBLIC_KEY =
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE3_j25RjhRphgpyZnL3sdnWSzkKoF2ZuKrq--xXEUPGnmk05ASQkhZX2EhCRPShijm7YmAzwu6qatzB2cueK5Jw';

/**
 * DEMO PRIVATE KEY. Published deliberately (see the header) so you can mint test
 * licenses. A real vendor's private key never appears in source.
 */
export const DEMO_LICENSE_PRIVATE_KEY =
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgV_S5zwBV8FP38xgzb2GRohb8WZjxdU8G1b8GEVqoe8WhRANCAATf-PblGOFGmGCnJmcvex2dZLOQqgXZm4qur77FcRQ8aeaTTkBJCSFlfYSEJE9KGKObtiYDPC7qpq3MHZy54rkn';

/**
 * A perpetual "pro" license for the demo vendor: 25 endpoints, delivery log, custom
 * headers. Paste it at Admin → Growth → Premium packages, or set
 * `PREMIUM_LICENSE_WEBHOOKS` to it.
 *
 * Perpetual (no `exp`) on purpose — a dated demo key would silently start failing for
 * everyone who cloned the repo after that date.
 */
export const DEMO_PRO_LICENSE =
    'obp1.eyJpZCI6ImxpY19kZW1vX3Byb18wMDAxIiwicGtnIjoid2ViaG9va3MiLCJwbGFuIjoicHJvIiwibGljZW5zZWUiOiJPdHRhYmFzZSBEZW1vIiwiZmVhdHVyZXMiOlsiZGVsaXZlcmllcy5sb2ciLCJjdXN0b20taGVhZGVycyJdLCJsaW1pdHMiOnsiZW5kcG9pbnRzIjoyNX0sImlhdCI6MTczNTY4OTYwMH0.yNy_XM1hjiwMCqOQUwC4INMt6FZ19jObyESanPU_C5hPv6cQhl0FbXwIXCvfn-smOz2ziqFIi784Mp4ErZ68mg';
