// ============================================================
// @ottabase/premium/license-tools — VENDOR-ONLY entrypoint
// ============================================================
// Key generation and license minting. A consuming app never imports this subpath;
// it exists so the private key and the app that verifies against it stay in separate
// bundles by construction rather than by discipline.
// ============================================================

export { generateLicenseKeypair, issueLicense, type IssueLicenseInput, type PremiumKeypair } from './license/issue';
