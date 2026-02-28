// ============================================================
// ResumeWorkExperience Model (App-specific)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import {
    resumeWorkExperiencesTable,
    type NewResumeWorkExperienceType,
    type ResumeWorkExperienceType,
} from './ResumeWorkExperience.schema';

export {
    resumeWorkExperiencesTable,
    type NewResumeWorkExperienceType,
    type ResumeWorkExperienceType,
} from './ResumeWorkExperience.schema';

/**
 * ResumeWorkExperience model — stores work history entries.
 * Highlights are stored as a JSON array of strings.
 *
 * @example
 * ```typescript
 * import { ResumeWorkExperience } from "./models/ResumeWorkExperience";
 * import { setDriver } from "@ottabase/ottaorm";
 *
 * setDriver(createD1Driver(env.DB));
 *
 * // Create work experience
 * const work = await ResumeWorkExperience.create({
 *   userId: "user-123",
 *   company: "Acme Inc.",
 *   designation: "Senior Engineer",
 *   startDate: "2022-01",
 *   isCurrent: true,
 *   highlights: JSON.stringify(["Led a team of 5", "Shipped v2.0"]),
 * });
 *
 * // Read highlights
 * const items = work.getHighlights(); // ["Led a team of 5", "Shipped v2.0"]
 * ```
 */
export class ResumeWorkExperience extends BaseModel {
    static entity = 'resume_work_experiences';
    static table = resumeWorkExperiencesTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        isCurrent: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        isCurrent: false,
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
                description: 'Experience owner',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: false,
            },
        },
        company: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Company',
                description: 'Company or organisation name',
                placeholder: 'e.g. Acme Inc.',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 200,
            },
            validation: {
                rules: 'required',
                messages: {
                    required: 'Company is required',
                },
            },
        },
        designation: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Designation',
                description: 'Job title or role',
                placeholder: 'e.g. Senior Engineer',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 200,
            },
            validation: {
                rules: 'required',
                messages: {
                    required: 'Designation is required',
                },
            },
        },
        location: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Location',
                description: 'Office location or remote',
                placeholder: 'e.g. New York, NY / Remote',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 160,
            },
        },
        startDate: {
            type: 'string',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Start Date',
                description: 'When you started (YYYY-MM)',
                placeholder: '2022-01',
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
                description: 'When you left (YYYY-MM), blank if current',
                placeholder: '2024-06',
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
        isCurrent: {
            type: 'boolean',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Current Role',
                description: 'Are you still working here?',
                defaultValue: false,
            },
            formConfig: {
                visible: true,
                fieldType: 'boolean',
            },
            tableConfig: {
                visible: true,
                colWidth: 100,
            },
        },
        description: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Description',
                description: 'Role summary or responsibilities',
                placeholder: 'Briefly describe your role...',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: false,
            },
        },
        highlights: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Highlights',
                description: 'Key achievements (JSON array of strings)',
                placeholder: '["Led team of 5","Increased perf by 40%"]',
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
        company: {
            rules: 'required',
            fieldName: 'Company',
            messages: {
                required: 'Company is required',
            },
        },
        designation: {
            rules: 'required',
            fieldName: 'Designation',
            messages: {
                required: 'Designation is required',
            },
        },
    };

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /** Parse the JSON highlights column into a string array */
    getHighlights(): string[] {
        const raw = this.get('highlights') as string | null;
        if (!raw) return [];
        try {
            return JSON.parse(raw) as string[];
        } catch {
            return [];
        }
    }

    /** Serialize a string array into the JSON highlights column */
    setHighlights(highlights: string[]) {
        this.set('highlights', JSON.stringify(highlights));
    }

    /** Get all work experiences for a user, ordered by startDate descending */
    static async forUser(userId: string) {
        return this.where(
            { userId },
            {
                orderBy: 'startDate',
                orderDirection: 'desc',
            },
        );
    }
}
