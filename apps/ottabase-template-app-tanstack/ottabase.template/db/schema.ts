// ============================================================
// Database Schema (ottabase-template-app-tanstack)
// ============================================================
//
// Exports all Drizzle table schemas for the application.
// Used by drizzle-kit (pnpm db:push / db:studio) and runtime autoInit.
//
// Tables come from THREE sources:
//   1. CORE — auth/user tables from @ottabase/ottaorm
//   2. APP  — your app-specific models (e.g. Todo)
//   3. PKG  — enabled packages (governed by ottabase.config.ts)
//
// The getAllSchemas() helper in schemas-helper.ts combines all three.
// This file re-exports everything drizzle-kit needs as named exports.
// ============================================================

import { getEnabledPackageTables } from '../config.migrations';

// ── Core tables (always included) ────────────────────────────
export {
    accountsTable,
    authenticatorsTable,
    sessionsTable,
    usersTable,
    verificationTokensTable,
} from '@ottabase/ottaorm';

// ── App-specific tables ──────────────────────────────────────
export { todosTable } from '../models/Todo';

// ── Package tables (config-driven) ──────────────────────────
// Collected dynamically from enabled packages in ottabase.config.ts.
// drizzle-kit picks these up via the spread; runtime uses getAllSchemas().
export const packageTables = getEnabledPackageTables();
