// ============================================================
// App Migrations (ottabase-template-app-tanstack)
// ============================================================

import type { Migration } from "@ottabase/ottaorm";

/**
 * App-specific migrations
 *
 * These run AFTER core migrations from @ottabase/ottaorm
 */
export const appMigrations: Migration[] = [
  {
    name: "001_create_todos_table",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS todos (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          user_id TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
    },
    down: async (db) => {
      await db.execute(`DROP TABLE IF EXISTS todos`);
    },
  },
];
