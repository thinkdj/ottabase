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
    timezone: text('timezone'),
    passwordHash: text('password_hash'),
    /** AES-GCM encrypted base32 TOTP secret (null when TOTP not configured) */
    totpSecretEnc: text('totp_secret_enc'),
    /** Unix ms when TOTP was verified and enabled; null if TOTP off */
    totpEnabledAt: integer('totp_enabled_at'),
    /** JSON array of PBKDF2 hashes for one-time backup codes (empty array when none) */
    backupCodesJson: text('backup_codes_json'),
    // Referral fields
    referralUsername: text('referral_username').unique(),
    referredById: text('referred_by_id'),
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
