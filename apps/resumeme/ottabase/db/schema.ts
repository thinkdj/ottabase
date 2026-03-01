// ============================================================
// Database Schema (ResumeMe)
// ============================================================
//
// This file exports all Drizzle table schemas for the application.
// It combines CORE tables from @ottabase/ottaorm + APP-SPECIFIC tables.
//
// Usage with drizzle-kit push (codebase first approach):
//   pnpm db:push   - Push schema changes to D1
//   pnpm db:studio - Open Drizzle Studio for database browsing
//
// The TypeScript schema is the single source of truth.
// No SQL migration files needed - drizzle-kit handles everything.
// ============================================================

// ============================================================
// CORE TABLES (from @ottabase/ottaorm)
// ============================================================
import {
    accountsTable,
    authenticatorsTable,
    sessionsTable,
    usersTable,
    verificationTokensTable,
} from '@ottabase/ottaorm';

export { accountsTable, authenticatorsTable, sessionsTable, usersTable, verificationTokensTable };

// ============================================================
// APP-SPECIFIC TABLES (Resume models)
// ============================================================
export { resumeCertificationsTable } from '../models/ResumeCertification';
export { resumeDataSetsTable } from '../models/ResumeDataSet';
export { resumeEducationsTable } from '../models/ResumeEducation';
export { resumeProfilesTable } from '../models/ResumeProfile';
export { resumeProjectsTable } from '../models/ResumeProject';
export { resumeSavedTable } from '../models/ResumeSaved';
export { resumeSkillSetsTable } from '../models/ResumeSkillSet';
export { resumeWorkExperiencesTable } from '../models/ResumeWorkExperience';

// ============================================================
// PACKAGE TABLES (Shortlinks)
// ============================================================
export { shortlinksTable } from '@ottabase/shortlinks';

// ============================================================
// DYNAMIC PACKAGE TABLES (Configured in config.migrations.ts)
// ============================================================
import { getEnabledPackageTables } from '../config.migrations';

export const packageTables = getEnabledPackageTables();
