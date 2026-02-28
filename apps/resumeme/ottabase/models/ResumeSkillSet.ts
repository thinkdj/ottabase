// ============================================================
// ResumeSkillSet Model (App-specific)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { resumeSkillSetsTable, type NewResumeSkillSetType, type ResumeSkillSetType } from './ResumeSkillSet.schema';

export { resumeSkillSetsTable, type NewResumeSkillSetType, type ResumeSkillSetType } from './ResumeSkillSet.schema';

/**
 * ResumeSkillSet model — groups skills under a named category.
 * Skills are stored as a JSON array of strings.
 *
 * @example
 * ```typescript
 * import { ResumeSkillSet } from "./models/ResumeSkillSet";
 * import { setDriver } from "@ottabase/ottaorm";
 *
 * setDriver(createD1Driver(env.DB));
 *
 * // Create skill set
 * const skillSet = await ResumeSkillSet.create({
 *   userId: "user-123",
 *   name: "Frontend",
 *   skills: JSON.stringify(["React", "TypeScript", "CSS"]),
 * });
 *
 * // Read/write skills array
 * const skills = skillSet.getSkills(); // ["React", "TypeScript", "CSS"]
 * skillSet.setSkills([...skills, "Tailwind"]);
 * await skillSet.save();
 * ```
 */
export class ResumeSkillSet extends BaseModel {
    static entity = 'resume_skill_sets';
    static table = resumeSkillSetsTable;
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
                description: 'Skill set owner',
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
                label: 'Category',
                description: 'Skill group name',
                placeholder: 'e.g. Frontend, Backend, DevOps',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 180,
            },
            validation: {
                rules: 'required',
                messages: {
                    required: 'Category name is required',
                },
            },
        },
        skills: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Skills',
                description: 'JSON array of skill names',
                placeholder: '["React", "TypeScript"]',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: true,
                colWidth: 'auto',
            },
            validation: {
                rules: 'required',
                messages: {
                    required: 'Skills list is required',
                },
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
            fieldName: 'Category',
            messages: {
                required: 'Category name is required',
            },
        },
        skills: {
            rules: 'required',
            fieldName: 'Skills',
            messages: {
                required: 'Skills list is required',
            },
        },
    };

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /** Parse the JSON skills column into a string array */
    getSkills(): string[] {
        const raw = this.get('skills') as string | null;
        if (!raw) return [];
        try {
            return JSON.parse(raw) as string[];
        } catch {
            return [];
        }
    }

    /** Serialize a string array into the JSON skills column */
    setSkills(skills: string[]) {
        this.set('skills', JSON.stringify(skills));
    }

    /** Get all skill sets for a given user */
    static async forUser(userId: string) {
        return this.where({ userId });
    }
}
