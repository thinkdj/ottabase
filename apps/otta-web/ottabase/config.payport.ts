// ============================================================
// PAYPORT — Single Source of Truth (client-safe half)
// ============================================================
//
// This module is imported transitively by the client bundle via
// `ottabase.config.ts`, so it MUST stay free of server-only deps
// (no `@ottabase/auth/backend`, no worker route handlers, no
// `nodemailer`, etc.). Server-only wiring lives in
// `./config.payport.server.ts`.
//
// Flip `PAYPORT_ENABLED = false` to fully disable Payport.
// Plans live in the DB (`payment_plans` table) and are managed
// from the admin UI at /admin/billing. First-run defaults live in
// `./config.payport.server.ts` and seed only when the table is empty.
// Provider credentials come from env vars
// (POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, POLAR_ORG_ID).
// ============================================================

import {
    paymentCheckoutsTable,
    paymentCustomersTable,
    paymentDiscountsTable,
    paymentEntitlementsTable,
    paymentEventsTable,
    paymentLicenseActivationsTable,
    paymentLicenseKeysTable,
    paymentMeterEventsTable,
    paymentMetersTable,
    paymentPlansTable,
    paymentProductsTable,
    paymentRefundsTable,
    paymentSubscriptionsTable,
} from '@ottabase/payport/schema';
import { PAYPORT_MODELS } from '@ottabase/payport/server';

// ── 1. Master switch ──────────────────────────────────────────
export const PAYPORT_ENABLED = true;

// ── 2. Tables (spread into customPackages.payport.tables) ─────
export const PAYPORT_TABLES = PAYPORT_ENABLED
    ? {
          paymentCheckoutsTable,
          paymentCustomersTable,
          paymentDiscountsTable,
          paymentEntitlementsTable,
          paymentEventsTable,
          paymentLicenseActivationsTable,
          paymentLicenseKeysTable,
          paymentMeterEventsTable,
          paymentMetersTable,
          paymentPlansTable,
          paymentProductsTable,
          paymentRefundsTable,
          paymentSubscriptionsTable,
      }
    : {};

// ── 3. Models (spread into registerModels in db-utils.ts) ─────
export const PAYPORT_MODEL_REGISTRATIONS = PAYPORT_ENABLED ? PAYPORT_MODELS : [];
