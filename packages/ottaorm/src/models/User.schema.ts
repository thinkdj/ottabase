// ============================================================
// @ottabase/ottaorm - User table schema
// ============================================================

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * User table schema
 */
export const usersTable = sqliteTable(
    'users',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        name: text('name'),
        email: text('email').notNull().unique(),
        emailVerified: integer('email_verified'),
        image: text('image'),
        timezone: text('timezone'),
        passwordHash: text('password_hash'),
        // Referral fields
        referralUsername: text('referral_username').unique(),
        referredById: text('referred_by_id'),
        // App identifier for multi-app database sharing (nullable, opt-in)
        appId: text('app_id'),
        // The user's currently-selected organization (persisted across sessions/devices).
        // This is a pointer only — membership is always re-validated server-side before use.
        activeOrganizationId: text('active_organization_id'),
        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (t) => ({
        // Referral attribution walks "who did I refer" via referredById. email and referralUsername
        // are already covered by their UNIQUE indexes.
        referredByIdx: index('users_referred_by_idx').on(t.referredById),
    }),
);

/**
 * User model type
 */
export type UserType = typeof usersTable.$inferSelect;
export type NewUserType = typeof usersTable.$inferInsert;
