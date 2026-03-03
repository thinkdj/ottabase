// ============================================================
// ResumeDataSet Model (App-specific)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { resumeDataSetsTable } from './ResumeDataSet.schema';

export { resumeDataSetsTable, type NewResumeDataSetType, type ResumeDataSetType } from './ResumeDataSet.schema';

/**
 * ResumeDataSet model — a named collection that assembles profile, skills,
 * work, education, projects, and certifications into a single resume.
 * Users can apply different templates and accent colours to each data set.
 *
 * @example
 * ```typescript
 * import { ResumeDataSet } from "./models/ResumeDataSet";
 * import { setDriver } from "@ottabase/ottaorm";
 *
 * setDriver(createD1Driver(env.DB));
 *
 * // Create data set
 * const ds = await ResumeDataSet.create({
 *   userId: "user-123",
 *   name: "Software Engineer Resume",
 *   profileId: "profile-abc",
 *   templateId: "classic",
 *   accentColor: "#475569",
 * });
 *
 * // Read/write selected IDs
 * ds.setSelectedSkillSetIds(["skill-1", "skill-2"]);
 * const ids = ds.getSelectedSkillSetIds(); // ["skill-1", "skill-2"]
 * await ds.save();
 * ```
 */
export class ResumeDataSet extends BaseModel {
    static entity = 'resume_data_sets';
    static table = resumeDataSetsTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        templateId: 'classic',
        accentColor: '#475569',
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'ID',
            },
        },
        userId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'User',
                description: 'Data set owner',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: false,
            },
        },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Name',
                description: 'Resume data set name',
                placeholder: 'e.g. Software Engineer Resume',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 'auto',
            },
            validation: {
                rules: 'required',
                messages: {
                    required: 'Name is required',
                },
            },
        },
        profileId: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Profile',
                description: 'Linked resume profile ID',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: false,
            },
        },
        summaryId: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Summary',
                description: 'Linked resume summary ID',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: false,
            },
        },
        templateId: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Template',
                description: 'Resume template identifier',
                defaultValue: 'classic',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: true,
                colWidth: 140,
            },
        },
        accentColor: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Accent Colour',
                description: 'Theme accent colour hex code',
                defaultValue: '#475569',
                placeholder: '#475569',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 120,
            },
        },
        selectedSkillSetIds: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Skill Sets',
                description: 'Selected skill set IDs (JSON array)',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: false,
            },
        },
        selectedWorkExperienceIds: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Work Experiences',
                description: 'Selected work experience IDs (JSON array)',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: false,
            },
        },
        selectedEducationIds: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Education',
                description: 'Selected education IDs (JSON array)',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: false,
            },
        },
        selectedProjectIds: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Projects',
                description: 'Selected project IDs (JSON array)',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: false,
            },
        },
        selectedCertificationIds: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Certifications',
                description: 'Selected certification IDs (JSON array)',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: false,
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Created',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Updated',
            },
            tableConfig: {
                visible: false,
            },
        },
    };

    protected static validationRules = {
        name: {
            rules: 'required',
            fieldName: 'Name',
            messages: {
                required: 'Name is required',
            },
        },
    };

    // ============================================================
    // GENERIC JSON ID HELPERS
    // ============================================================

    /** Parse a JSON ID-array field into a string array */
    getSelectedIds(field: string): string[] {
        const raw = this.get(field) as string | null;
        if (!raw) return [];
        try {
            return JSON.parse(raw) as string[];
        } catch {
            return [];
        }
    }

    /** Serialize a string array into a JSON ID-array field */
    setSelectedIds(field: string, ids: string[]) {
        this.set(field, JSON.stringify(ids));
    }

    // ============================================================
    // CONVENIENCE GETTERS / SETTERS
    // ============================================================

    getSelectedSkillSetIds(): string[] {
        return this.getSelectedIds('selectedSkillSetIds');
    }

    setSelectedSkillSetIds(ids: string[]) {
        this.setSelectedIds('selectedSkillSetIds', ids);
    }

    getSelectedWorkExperienceIds(): string[] {
        return this.getSelectedIds('selectedWorkExperienceIds');
    }

    setSelectedWorkExperienceIds(ids: string[]) {
        this.setSelectedIds('selectedWorkExperienceIds', ids);
    }

    getSelectedEducationIds(): string[] {
        return this.getSelectedIds('selectedEducationIds');
    }

    setSelectedEducationIds(ids: string[]) {
        this.setSelectedIds('selectedEducationIds', ids);
    }

    getSelectedProjectIds(): string[] {
        return this.getSelectedIds('selectedProjectIds');
    }

    setSelectedProjectIds(ids: string[]) {
        this.setSelectedIds('selectedProjectIds', ids);
    }

    getSelectedCertificationIds(): string[] {
        return this.getSelectedIds('selectedCertificationIds');
    }

    setSelectedCertificationIds(ids: string[]) {
        this.setSelectedIds('selectedCertificationIds', ids);
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /** Get all data sets for a given user */
    static async forUser(userId: string) {
        return this.where({ userId });
    }
}
