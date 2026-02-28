// ============================================================
// ResumeProject Model (App-specific)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { resumeProjectsTable, type NewResumeProjectType, type ResumeProjectType } from './ResumeProject.schema';

export { resumeProjectsTable, type NewResumeProjectType, type ResumeProjectType } from './ResumeProject.schema';

/**
 * ResumeProject model — stores portfolio/project entries.
 * Tech stack is stored as a JSON array of strings.
 *
 * @example
 * ```typescript
 * import { ResumeProject } from "./models/ResumeProject";
 * import { setDriver } from "@ottabase/ottaorm";
 *
 * setDriver(createD1Driver(env.DB));
 *
 * // Create project
 * const project = await ResumeProject.create({
 *   userId: "user-123",
 *   title: "OttaBase",
 *   description: "Full-stack monorepo framework",
 *   techStack: JSON.stringify(["TypeScript", "React", "Cloudflare Workers"]),
 * });
 *
 * // Read/write tech stack
 * const stack = project.getTechStack(); // ["TypeScript", "React", ...]
 * project.setTechStack([...stack, "D1"]);
 * await project.save();
 * ```
 */
export class ResumeProject extends BaseModel {
    static entity = 'resume_projects';
    static table = resumeProjectsTable;
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
                description: 'Project owner',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: false,
            },
        },
        title: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Title',
                description: 'Project name',
                placeholder: 'e.g. My Awesome App',
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
                    required: 'Title is required',
                },
            },
        },
        description: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Description',
                description: 'What the project does',
                placeholder: 'A short description of the project',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: false,
            },
        },
        url: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'URL',
                description: 'Project link (live site or repo)',
                placeholder: 'https://github.com/you/project',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 200,
            },
        },
        techStack: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Tech Stack',
                description: 'Technologies used (JSON array of strings)',
                placeholder: '["React", "Node.js", "PostgreSQL"]',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: true,
                colWidth: 200,
            },
        },
        startDate: {
            type: 'string',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Start Date',
                description: 'When the project started (YYYY-MM)',
                placeholder: '2023-01',
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
                description: 'When the project ended (YYYY-MM)',
                placeholder: '2024-03',
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
        title: {
            rules: 'required',
            fieldName: 'Title',
            messages: {
                required: 'Title is required',
            },
        },
    };

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /** Parse the JSON techStack column into a string array */
    getTechStack(): string[] {
        const raw = this.get('techStack') as string | null;
        if (!raw) return [];
        try {
            return JSON.parse(raw) as string[];
        } catch {
            return [];
        }
    }

    /** Serialize a string array into the JSON techStack column */
    setTechStack(techStack: string[]) {
        this.set('techStack', JSON.stringify(techStack));
    }

    /** Get all projects for a given user */
    static async forUser(userId: string) {
        return this.where({ userId });
    }
}
