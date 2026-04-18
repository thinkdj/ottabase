// ---------------------------------------------------------------------------
// Brand Engine – Custom migrations
// Indexes for menu_items to optimize WHERE appId and WHERE menuId queries.
// ---------------------------------------------------------------------------

import type { Migration } from '@ottabase/ottaorm';

export const brandEngineMigrations: Migration[] = [
    {
        name: 'brand_001_menu_items_indexes',
        up: async (db) => {
            await db.executeRaw(`CREATE INDEX IF NOT EXISTS menu_items_appid_idx ON menu_items(app_id)`);
            await db.executeRaw(`CREATE INDEX IF NOT EXISTS menu_items_menuid_idx ON menu_items(menu_id)`);
        },
    },
];
