import { describe, it, expect } from 'vitest';
import { ResumeProfile } from '../../ottabase/models/ResumeProfile';
import { ResumeSkillSet } from '../../ottabase/models/ResumeSkillSet';
import { ResumeWorkExperience } from '../../ottabase/models/ResumeWorkExperience';
import { ResumeEducation } from '../../ottabase/models/ResumeEducation';
import { ResumeProject } from '../../ottabase/models/ResumeProject';
import { ResumeCertification } from '../../ottabase/models/ResumeCertification';
import { ResumeDataSet } from '../../ottabase/models/ResumeDataSet';

describe('Resume Fat Models', () => {
    const models = [
        { Model: ResumeProfile, entity: 'resume_profiles' },
        { Model: ResumeSkillSet, entity: 'resume_skill_sets' },
        { Model: ResumeWorkExperience, entity: 'resume_work_experiences' },
        { Model: ResumeEducation, entity: 'resume_educations' },
        { Model: ResumeProject, entity: 'resume_projects' },
        { Model: ResumeCertification, entity: 'resume_certifications' },
        { Model: ResumeDataSet, entity: 'resume_data_sets' },
    ];

    for (const { Model, entity } of models) {
        describe(Model.name, () => {
            it(`has entity "${entity}"`, () => {
                expect(Model.entity).toBe(entity);
            });

            it('has table defined', () => {
                expect(Model.table).toBeDefined();
            });

            it('has primaryKey "id"', () => {
                expect(Model.primaryKey).toBe('id');
            });

            it('has packageType "app"', () => {
                expect(Model.packageType).toBe('app');
            });

            it('has date casts', () => {
                expect(Model.casts).toHaveProperty('createdAt', 'date');
                expect(Model.casts).toHaveProperty('updatedAt', 'date');
            });
        });
    }

    describe('ResumeWorkExperience', () => {
        it('casts isCurrent as boolean', () => {
            expect(ResumeWorkExperience.casts).toHaveProperty('isCurrent', 'boolean');
        });
    });

    describe('ResumeDataSet', () => {
        it('has defaults for templateId and accentColor', () => {
            const defaults = (ResumeDataSet as any).defaults;
            expect(defaults).toBeDefined();
            expect(defaults.templateId).toBe('classic');
            expect(defaults.accentColor).toBe('#475569');
        });
    });
});
