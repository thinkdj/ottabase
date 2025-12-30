// ============================================================
// Database Schema for Drizzle-Kit (ottabase-template-app-tanstack)
// ============================================================
//
// This file exports all Drizzle table schemas for migration generation.
// Run `pnpm db:generate` to generate SQL migration files.
//
// NOTE: This is a "codebase first" approach (Drizzle Option 2)
// - Schema is defined in TypeScript
// - drizzle-kit generates SQL migrations from schema changes
// - wrangler d1 migrations apply applies migrations to D1
//
// IMPORTANT: Only export table definitions here, not model classes.
// This keeps the schema lightweight for drizzle-kit processing.
// ============================================================

import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// ============================================================
// Core Tables (from @ottabase/ottaorm)
// ============================================================

/**
 * Users table - Core user model
 */
export const usersTable = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Accounts table - OAuth/Auth provider accounts
 */
export const accountsTable = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: text("token_type"),
  scope: text("scope"),
  idToken: text("id_token"),
  sessionState: text("session_state"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Sessions table - User sessions
 */
export const sessionsTable = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  userId: text("user_id").notNull(),
  expires: text("expires").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Verification tokens table - Email verification, password reset, etc.
 */
export const verificationTokensTable = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: text("expires").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  })
);

/**
 * Authenticators table - WebAuthn/Passkey credentials
 */
export const authenticatorsTable = sqliteTable("authenticators", {
  id: text("id").primaryKey(),
  credentialId: text("credential_id").notNull().unique(),
  userId: text("user_id").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  credentialPublicKey: text("credential_public_key").notNull(),
  counter: integer("counter").notNull(),
  credentialDeviceType: text("credential_device_type").notNull(),
  credentialBackedUp: integer("credential_backed_up").notNull(),
  transports: text("transports"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Posts table - Blog posts and content
 */
export const postsTable = sqliteTable("posts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content"),
  excerpt: text("excerpt"),
  published: integer("published", { mode: "boolean" }).default(false).notNull(),
  authorId: text("author_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Tags table - Content tags
 */
export const tagsTable = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Post-Tags pivot table - Many-to-many relationship
 */
export const postTagsTable = sqliteTable(
  "post_tags",
  {
    postId: text("post_id").notNull(),
    tagId: text("tag_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.tagId] }),
  })
);

// ============================================================
// App-Specific Tables
// ============================================================

/**
 * Todos table - App-specific todo items
 */
export const todosTable = sqliteTable("todos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).default(false).notNull(),
  userId: text("user_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
