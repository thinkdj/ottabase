import { describe, it, expect } from 'vitest';
import { resumeProfilesTable } from '../../ottabase/models/ResumeProfile.schema';
import { resumeSkillSetsTable } from '../../ottabase/models/ResumeSkillSet.schema';
import { resumeWorkExperiencesTable } from '../../ottabase/models/ResumeWorkExperience.schema';
import { resumeEducationsTable } from '../../ottabase/models/ResumeEducation.schema';
import { resumeProjectsTable } from '../../ottabase/models/ResumeProject.schema';
import { resumeCertificationsTable } from '../../ottabase/models/ResumeCertification.schema';
import { resumeDataSetsTable } from '../../ottabase/models/ResumeDataSet.schema';

describe('Resume Model Schemas', () => {
    it('defines resume_profiles table', () => {
        const columns = Object.keys(resumeProfilesTable);
        expect(columns).toContain('id');
        expect(columns).toContain('userId');
        expect(columns).toContain('headline');
        expect(columns).toContain('summary');
        expect(columns).toContain('email');
        expect(columns).toContain('phone');
        expect(columns).toContain('location');
        expect(columns).toContain('createdAt');
        expect(columns).toContain('updatedAt');
    });

    it('defines resume_skill_sets table', () => {
        const columns = Object.keys(resumeSkillSetsTable);
        expect(columns).toContain('id');
        expect(columns).toContain('userId');
        expect(columns).toContain('name');
        expect(columns).toContain('skills');
    });

    it('defines resume_work_experiences table', () => {
        const columns = Object.keys(resumeWorkExperiencesTable);
        expect(columns).toContain('id');
        expect(columns).toContain('company');
        expect(columns).toContain('designation');
        expect(columns).toContain('startDate');
        expect(columns).toContain('endDate');
        expect(columns).toContain('isCurrent');
        expect(columns).toContain('highlights');
    });

    it('defines resume_educations table', () => {
        const columns = Object.keys(resumeEducationsTable);
        expect(columns).toContain('id');
        expect(columns).toContain('institution');
        expect(columns).toContain('degree');
        expect(columns).toContain('field');
    });

    it('defines resume_projects table', () => {
        const columns = Object.keys(resumeProjectsTable);
        expect(columns).toContain('id');
        expect(columns).toContain('title');
        expect(columns).toContain('description');
        expect(columns).toContain('url');
        expect(columns).toContain('techStack');
    });

    it('defines resume_certifications table', () => {
        const columns = Object.keys(resumeCertificationsTable);
        expect(columns).toContain('id');
        expect(columns).toContain('name');
        expect(columns).toContain('issuer');
        expect(columns).toContain('issueDate');
    });

    it('defines resume_data_sets table', () => {
        const columns = Object.keys(resumeDataSetsTable);
        expect(columns).toContain('id');
        expect(columns).toContain('userId');
        expect(columns).toContain('name');
        expect(columns).toContain('profileId');
        expect(columns).toContain('templateId');
        expect(columns).toContain('accentColor');
        expect(columns).toContain('selectedSkillSetIds');
        expect(columns).toContain('selectedWorkExperienceIds');
        expect(columns).toContain('selectedEducationIds');
        expect(columns).toContain('selectedProjectIds');
        expect(columns).toContain('selectedCertificationIds');
    });

    it('all tables have userId column', () => {
        const tables = [
            resumeProfilesTable,
            resumeSkillSetsTable,
            resumeWorkExperiencesTable,
            resumeEducationsTable,
            resumeProjectsTable,
            resumeCertificationsTable,
            resumeDataSetsTable,
        ];

        for (const table of tables) {
            expect(Object.keys(table)).toContain('userId');
        }
    });
});
