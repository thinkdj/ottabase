// ============================================================
// Database Schema (ottabase-template-app)
// ============================================================
//
// This file exports all Drizzle table schemas for the application.
// It combines CORE tables from @ottabase/ottaorm + APP-SPECIFIC tables.
//
// Usage with drizzle-kit push (codebase first approach):
//   pnpm db:push        - Push schema changes to remote D1
//   pnpm db:studio      - Open Drizzle Studio for database browsing
//
// The TypeScript schema is the single source of truth.
// No SQL migration files needed - drizzle-kit handles everything.
// ============================================================

// ============================================================
// CORE TABLES (from @ottabase/ottaorm)
// ============================================================
export {
    // User & Auth
    usersTable,
    accountsTable,
    sessionsTable,
    verificationTokensTable,
    authenticatorsTable,
    // Content
    postsTable,
    postTagsTable,
    tagsTable,
} from '@ottabase/ottaorm';

// ============================================================
// APP-SPECIFIC TABLES
// ============================================================
export { todosTable } from '../models/Todo';
