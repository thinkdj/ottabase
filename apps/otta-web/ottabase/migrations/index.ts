// ============================================================
// Migrations auto-init runs after creating the tables: the app's own, then every
// package's (ottabase/packages.ts). A package that needs more than "create the table"
// (an index swap, a backfill) ships it in its manifest's `migrations`.
// ============================================================

import type { Migration } from '@ottabase/ottaorm';
import { packages } from '../packages';

/** Migrations for tables this app owns (see ottabase/models). */
const appMigrations: Migration[] = [];

export function buildAppMigrations(): Migration[] {
    return [...appMigrations, ...packages.migrations()];
}
