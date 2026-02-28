// ============================================================
// ResumeEducation Model (App-specific)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { resumeEducationsTable, type NewResumeEducationType, type ResumeEducationType } from './ResumeEducation.schema';

export { resumeEducationsTable, type NewResumeEducationType, type ResumeEducationType } from './ResumeEducation.schema';

/**
 * ResumeEducation model — stores education history entries.
 *
 * @example
 * ```typescript
 * import { ResumeEducation } from "./models/ResumeEducation";
 * import { setDriver } from "@ottabase/ottaorm";
 *
 * setDriver(createD1Driver(env.DB));
 *
 * // Create education entry
 * const edu = await ResumeEducation.create({
 *   userId: "user-123",
 *   institution: "MIT",
 *   degree: "B.S.",
 *   field: "Computer Science",
 *   startDate: "2016-09",
 *   endDate: "2020-06",
 * });
 *
 * // Get all education for a user
 * const entries = await ResumeEducation.forUser("user-123");
 * ```
 */
export class ResumeEducation extends BaseModel {
    static entity = 'resume_educations';
    static table = resumeEducationsTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
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
                description: 'Education entry owner',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: false,
            },
        },
        institution: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Institution',
                description: 'School, university, or training provider',
                placeholder: 'e.g. MIT',
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
                    required: 'Institution is required',
                },
            },
        },
        degree: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Degree',
                description: 'Degree or qualification type',
                placeholder: 'e.g. B.S., M.S., Ph.D.',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 160,
            },
            validation: {
                rules: 'required',
                messages: {
                    required: 'Degree is required',
                },
            },
        },
        field: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Field of Study',
                description: 'Major or area of concentration',
                placeholder: 'e.g. Computer Science',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 180,
            },
        },
        startDate: {
            type: 'string',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Start Date',
                description: 'When you enrolled (YYYY-MM)',
                placeholder: '2016-09',
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
        endDate: {
            type: 'string',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'End Date',
                description: 'When you graduated (YYYY-MM)',
                placeholder: '2020-06',
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
        grade: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Grade',
                description: 'GPA or classification',
                placeholder: 'e.g. 3.8/4.0',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: false,
            },
        },
        description: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Description',
                description: 'Additional details about this education',
                placeholder: 'Relevant coursework, thesis, or activities',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
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
        institution: {
            rules: 'required',
            fieldName: 'Institution',
            messages: {
                required: 'Institution is required',
            },
        },
        degree: {
            rules: 'required',
            fieldName: 'Degree',
            messages: {
                required: 'Degree is required',
            },
        },
    };

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /** Get all education entries for a given user */
    static async forUser(userId: string) {
        return this.where({ userId });
    }
}
