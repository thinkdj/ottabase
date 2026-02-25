// ============================================================
// @ottabase/ottaorm - User table schema
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * User table schema
 */
export const usersTable = sqliteTable('users', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text('name'),
    email: text('email').notNull().unique(),
    emailVerified: integer('email_verified'),
    image: text('image'),
    passwordHash: text('password_hash'),
    // Username (public handle, separate from referral username)
    username: text('username').unique(),
    // Referral fields
    referralUsername: text('referral_username').unique(),
    referredById: text('referred_by_id'),
    referralUsernameChanges: integer('referral_username_changes').default(0).notNull(),
    // App identifier for multi-app database sharing (nullable, opt-in)
    appId: text('app_id'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

/**
 * User model type
 */
export type UserType = typeof usersTable.$inferSelect;
export type NewUserType = typeof usersTable.$inferInsert;
