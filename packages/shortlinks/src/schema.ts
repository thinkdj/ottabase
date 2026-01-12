import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Shortlinks table schema for URL shortening service
 *
 * Supports multiple apps using the same database via appName field
 * Enables custom short codes and optional expiry dates
 */
export const shortlinksTable = sqliteTable("shortlinks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // The full destination URL
  fullUrl: text("full_url").notNull(),

  // The short identifier (e.g., "gh" in go.example.com/gh)
  shortCode: text("short_code").notNull().unique(),

  // Type of link (e.g., "redirect", "tracking", "internal")
  type: text("type").notNull().default("redirect"),

  // App identifier for multi-tenant support
  appName: text("app_name").notNull().default("default"),

  // Optional expiry timestamp
  expiryDate: integer("expiry_date", { mode: "timestamp" }),

  // Analytics
  clicks: integer("clicks").notNull().default(0),
  lastClickedAt: integer("last_clicked_at", { mode: "timestamp" }),

  // Metadata
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),

  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
});

export type Shortlink = typeof shortlinksTable.$inferSelect;
export type NewShortlink = typeof shortlinksTable.$inferInsert;
