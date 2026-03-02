// ============================================================
// Schema Collection Helper (ResumeMe)
// ============================================================
//
// Collects and organizes all table schemas from different sources:
// 1. CORE schemas (from @ottabase/ottaorm)
// 2. APP schemas (resume models)
// 3. PACKAGE schemas (from enabled packages)
// ============================================================

import {
    accountsTable,
    auditLogsTable,
    authenticatorsTable,
    organizationMembersTable,
    organizationsTable,
    permissionsTable,
    rolesTable,
    scheduledTasksTable,
    sessionsTable,
    tagsTable,
    userRolesTable,
    usersTable,
    verificationTokensTable,
} from '@ottabase/ottaorm';
import { shortlinksTable } from '@ottabase/shortlinks';
import { getEnabledPackageTables } from '../config.migrations';
import { knowledgeBasesTable } from '../models/KnowledgeBase';
import { knowledgeBaseFilesTable } from '../models/KnowledgeBaseFile';
import { resumeCertificationsTable } from '../models/ResumeCertification';
import { resumeDataSetsTable } from '../models/ResumeDataSet';
import { resumeEducationsTable } from '../models/ResumeEducation';
import { resumeProfilesTable } from '../models/ResumeProfile';
import { resumeProjectsTable } from '../models/ResumeProject';
import { resumeSavedTable } from '../models/ResumeSaved';
import { resumeSkillSetsTable } from '../models/ResumeSkillSet';
import { resumeWorkExperiencesTable } from '../models/ResumeWorkExperience';

/**
 * Get all table schemas organized by source
 */
export function getAllSchemas() {
    // 1. Core schemas from @ottabase/ottaorm
    const coreTables = {
        accountsTable,
        authenticatorsTable,
        sessionsTable,
        tagsTable,
        usersTable,
        verificationTokensTable,
        scheduledTasksTable,
        organizationsTable,
        organizationMembersTable,
        rolesTable,
        permissionsTable,
        userRolesTable,
        auditLogsTable,
    };

    // 2. App-specific schemas (resume models) + enabled package schemas
    const appTables = {
        shortlinksTable,
        resumeProfilesTable,
        resumeSkillSetsTable,
        resumeWorkExperiencesTable,
        resumeEducationsTable,
        resumeProjectsTable,
        resumeCertificationsTable,
        resumeDataSetsTable,
        resumeSavedTable,
        knowledgeBasesTable,
        knowledgeBaseFilesTable,
    };

    // 3. Package schemas from enabled packages
    const packageTables = getEnabledPackageTables();

    return {
        ...coreTables,
        ...appTables,
        ...packageTables,
    };
}

/**
 * Get schema breakdown for debugging/status
 */
export function getSchemaSummary() {
    const coreTables = {
        accountsTable,
        authenticatorsTable,
        sessionsTable,
        tagsTable,
        usersTable,
        verificationTokensTable,
        scheduledTasksTable,
        organizationsTable,
        organizationMembersTable,
        rolesTable,
        permissionsTable,
        userRolesTable,
        auditLogsTable,
    };

    const appTables = {
        shortlinksTable,
        resumeProfilesTable,
        resumeSkillSetsTable,
        resumeWorkExperiencesTable,
        resumeEducationsTable,
        resumeProjectsTable,
        resumeCertificationsTable,
        resumeDataSetsTable,
        resumeSavedTable,
        knowledgeBasesTable,
        knowledgeBaseFilesTable,
    };

    const packageTables = getEnabledPackageTables();

    return {
        core: Object.keys(coreTables),
        app: Object.keys(appTables),
        packages: Object.keys(packageTables),
        total: Object.keys({
            ...coreTables,
            ...appTables,
            ...packageTables,
        }).length,
    };
}
