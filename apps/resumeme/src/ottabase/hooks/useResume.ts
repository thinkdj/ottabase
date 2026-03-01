// Resume hooks — client-side TanStack Query hooks for all resume entities

import { createModelHooks } from '@ottabase/ottaorm/client';
import type { ResumeCertificationType } from '../../../ottabase/models/ResumeCertification';
import type { ResumeDataSetType } from '../../../ottabase/models/ResumeDataSet';
import type { ResumeEducationType } from '../../../ottabase/models/ResumeEducation';
import type { ResumeProfileType } from '../../../ottabase/models/ResumeProfile';
import type { ResumeProjectType } from '../../../ottabase/models/ResumeProject';
import type { ResumeSavedType } from '../../../ottabase/models/ResumeSaved';
import type { ResumeSkillSetType } from '../../../ottabase/models/ResumeSkillSet';
import type { ResumeWorkExperienceType } from '../../../ottabase/models/ResumeWorkExperience';

// ── ResumeProfile ──────────────────────────────────────────
export const {
    useList: useResumeProfiles,
    useDetail: useResumeProfile,
    useCreate: useCreateResumeProfile,
    useUpdate: useUpdateResumeProfile,
    useDelete: useDeleteResumeProfile,
} = createModelHooks<ResumeProfileType>({ entityName: 'resume_profiles' });

// ── ResumeSkillSet ─────────────────────────────────────────
export const {
    useList: useResumeSkillSets,
    useDetail: useResumeSkillSet,
    useCreate: useCreateResumeSkillSet,
    useUpdate: useUpdateResumeSkillSet,
    useDelete: useDeleteResumeSkillSet,
} = createModelHooks<ResumeSkillSetType>({ entityName: 'resume_skill_sets' });

// ── ResumeWorkExperience ───────────────────────────────────
export const {
    useList: useResumeWorkExperiences,
    useDetail: useResumeWorkExperience,
    useCreate: useCreateResumeWorkExperience,
    useUpdate: useUpdateResumeWorkExperience,
    useDelete: useDeleteResumeWorkExperience,
} = createModelHooks<ResumeWorkExperienceType>({ entityName: 'resume_work_experiences' });

// ── ResumeEducation ────────────────────────────────────────
export const {
    useList: useResumeEducations,
    useDetail: useResumeEducation,
    useCreate: useCreateResumeEducation,
    useUpdate: useUpdateResumeEducation,
    useDelete: useDeleteResumeEducation,
} = createModelHooks<ResumeEducationType>({ entityName: 'resume_educations' });

// ── ResumeProject ──────────────────────────────────────────
export const {
    useList: useResumeProjects,
    useDetail: useResumeProject,
    useCreate: useCreateResumeProject,
    useUpdate: useUpdateResumeProject,
    useDelete: useDeleteResumeProject,
} = createModelHooks<ResumeProjectType>({ entityName: 'resume_projects' });

// ── ResumeCertification ────────────────────────────────────
export const {
    useList: useResumeCertifications,
    useDetail: useResumeCertification,
    useCreate: useCreateResumeCertification,
    useUpdate: useUpdateResumeCertification,
    useDelete: useDeleteResumeCertification,
} = createModelHooks<ResumeCertificationType>({ entityName: 'resume_certifications' });

// ── ResumeDataSet ──────────────────────────────────────────
export const {
    useList: useResumeDataSets,
    useDetail: useResumeDataSet,
    useCreate: useCreateResumeDataSet,
    useUpdate: useUpdateResumeDataSet,
    useDelete: useDeleteResumeDataSet,
} = createModelHooks<ResumeDataSetType>({ entityName: 'resume_data_sets' });

// ── ResumeSaved ────────────────────────────────────────────
export const {
    useList: useResumeSavedList,
    useDetail: useResumeSaved,
    useCreate: useCreateResumeSaved,
    useUpdate: useUpdateResumeSaved,
    useDelete: useDeleteResumeSaved,
} = createModelHooks<ResumeSavedType>({ entityName: 'resume_saved' });
