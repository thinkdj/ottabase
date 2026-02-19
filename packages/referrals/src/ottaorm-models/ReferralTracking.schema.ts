// ============================================================
// ReferralTracking table schema
// ============================================================

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Referral Tracking Table
 *
 * Tracks all referral link clicks and conversions.
 * Each click creates a record with status 'pending', which updates to 'completed' on signup.
 */
export const referralTrackingTable = sqliteTable(
    'referral_tracking',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        // Referrer information
        userId: text('user_id').notNull(), // The user who owns the referral code
        referralCode: text('referral_code').notNull(), // The code used (snapshot at click time)

        // Referred user (null until conversion)
        referredUserId: text('referred_user_id'),

        // Tracking status
        status: text('status', { enum: ['pending', 'completed', 'invalid'] })
            .notNull()
            .default('pending'),

        // Click metadata
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        referer: text('referer'), // HTTP "Referer" header (intentionally uses the historical header spelling for the column name)

        // UTM and additional metadata (JSON)
        meta: text('meta', { mode: 'json' }).$type<{
            utm?: {
                source?: string;
                medium?: string;
                campaign?: string;
                term?: string;
                content?: string;
            };
            headers?: Record<string, string>;
            [key: string]: any;
        }>(),

        // Timestamps
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        conversionAt: integer('conversion_at'),

        // App identifier for multi-app database sharing (nullable, opt-in)
        appId: text('app_id'),
    },
    (table) => ({
        userIdIdx: index('referral_tracking_user_id_idx').on(table.userId),
        referredUserIdIdx: index('referral_tracking_referred_user_id_idx').on(table.referredUserId),
        referralCodeIdx: index('referral_tracking_referral_code_idx').on(table.referralCode),
        statusIdx: index('referral_tracking_status_idx').on(table.status),
        appIdIdx: index('referral_tracking_app_id_idx').on(table.appId),
    }),
);

export type ReferralTrackingRecord = typeof referralTrackingTable.$inferSelect;
export type ReferralTrackingInsert = typeof referralTrackingTable.$inferInsert;
