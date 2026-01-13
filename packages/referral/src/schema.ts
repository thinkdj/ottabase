import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Referrals table schema for tracking referral relationships
 *
 * Supports multiple apps using the same database via appName field
 * Tracks referrer information and conversion status
 */
export const referralsTable = sqliteTable("referrals", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // The referrer code/identifier (e.g., "john123", "abc-xyz")
  referrerCode: text("referrer_code").notNull(),

  // User who was referred (optional, set after signup)
  referredUserId: text("referred_user_id"),

  // App identifier for multi-tenant support
  appName: text("app_name").notNull().default("default"),

  // Source of the referral (e.g., "link", "qr", "email")
  source: text("source").default("link"),

  // Landing page URL where the referral happened
  landingUrl: text("landing_url"),

  // IP address of the referred user (optional)
  ipAddress: text("ip_address"),

  // User agent of the referred user (optional)
  userAgent: text("user_agent"),

  // Whether the referral resulted in a conversion (signup/purchase)
  converted: integer("converted", { mode: "boolean" }).notNull().default(false),

  // Timestamp when conversion happened
  convertedAt: integer("converted_at", { mode: "timestamp" }),

  // Additional metadata as JSON string
  metadata: text("metadata"),

  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),

  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
});

export type Referral = typeof referralsTable.$inferSelect;
export type NewReferral = typeof referralsTable.$inferInsert;
