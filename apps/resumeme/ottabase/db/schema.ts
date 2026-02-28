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
export { resumeProfilesTable } from '../models/ResumeProfile';
export { resumeSkillSetsTable } from '../models/ResumeSkillSet';
export { resumeWorkExperiencesTable } from '../models/ResumeWorkExperience';
export { resumeEducationsTable } from '../models/ResumeEducation';
export { resumeProjectsTable } from '../models/ResumeProject';
export { resumeCertificationsTable } from '../models/ResumeCertification';
export { resumeDataSetsTable } from '../models/ResumeDataSet';

// ============================================================
// DYNAMIC PACKAGE TABLES (Configured in config.migrations.ts)
// ============================================================
import { getEnabledPackageTables } from '../config.migrations';

export const packageTables = getEnabledPackageTables();
