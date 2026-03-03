// ============================================================
// ResumeSaved Model (App-specific)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { resumeSavedTable } from './ResumeSaved.schema';

export { resumeSavedTable, type NewResumeSavedType, type ResumeSavedType } from './ResumeSaved.schema';

/**
 * ResumeSaved model — a fully-expanded, frozen resume snapshot.
 *
 * When a user clicks "Save" in the builder, the full resolved data (including
 * profile, skills, work experience, education, projects, certifications) is
 * serialised alongside style settings (template, colour, scale, section order,
 * heading labels).  The resulting record can be reopened in view-only mode, or
 * its dynamic data can be "refreshed" from the linked data set and saved again.
 *
 * @example
 * ```typescript
 * const resume = await ResumeSaved.create({
 *     userId: 'user-123',
 *     name: 'Frontend Developer Resume',
 *     dataSetId: 'ds-abc',
 *     templateId: 'modern',
 *     accentColor: '#1d4ed8',
 *     fontSize: 100,
 *     sectionOrder: JSON.stringify(['summary', 'workExperiences', 'skillSets']),
 *     headingLabels: JSON.stringify({}),
 *     snapshotData: JSON.stringify(resolvedData),
 * });
 * ```
 */
export class ResumeSaved extends BaseModel {
    static entity = 'resume_saved';
    static table = resumeSavedTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        fontSize: 'number' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
        shareEnabled: 'boolean' as const,
    };

    protected static defaults = {
        templateId: 'classic',
        accentColor: '#475569',
        fontSize: 100,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        userId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'User',
                description: 'Resume owner',
            },
            formConfig: { visible: true, fieldType: 'select' },
            tableConfig: { visible: false },
        },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Name',
                description: 'Resume filename / display name',
                placeholder: 'e.g. Frontend Developer Resume',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
            validation: {
                rules: 'required',
                messages: { required: 'Name is required' },
            },
        },
        dataSetId: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Data Set',
                description: 'Linked resume data set (for refresh)',
            },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        templateId: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Template',
                description: 'Template identifier',
                defaultValue: 'classic',
            },
            formConfig: { visible: true, fieldType: 'select' },
            tableConfig: { visible: true, colWidth: 140 },
        },
        accentColor: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Accent Colour',
                description: 'Theme accent colour hex',
                defaultValue: '#475569',
                placeholder: '#475569',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 120 },
        },
        fontSize: {
            type: 'number',
            editable: true,
            uiConfig: {
                label: 'Page Scale',
                description: 'Zoom percentage (80–130)',
                defaultValue: 100,
            },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        sectionOrder: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Section Order',
                description: 'JSON array of SectionKey values',
            },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        headingLabels: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Heading Labels',
                description: 'JSON object of heading overrides',
            },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        snapshotData: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Snapshot Data',
                description: 'Full JSON resume data snapshot',
            },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        shareEnabled: {
            type: 'boolean',
            editable: true,
            uiConfig: {
                label: 'Sharing Enabled',
                description: 'Allow public access via share link',
                defaultValue: true,
            },
            formConfig: { visible: true, fieldType: 'toggle' },
            tableConfig: { visible: true, colWidth: 140 },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Updated' },
            tableConfig: { visible: false },
        },
    };

    protected static validationRules = {
        name: {
            rules: 'required',
            fieldName: 'Name',
            messages: { required: 'Name is required' },
        },
    };

    // ── Convenience ──────────────────────────────────────────

    /** Parse the snapshot JSON data */
    getSnapshotData<T = unknown>(): T | null {
        const raw = this.get('snapshotData') as string | null;
        if (!raw) return null;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    }

    /** Parse the section order JSON array */
    getSectionOrder(): string[] {
        const raw = this.get('sectionOrder') as string | null;
        if (!raw) return [];
        try {
            return JSON.parse(raw) as string[];
        } catch {
            return [];
        }
    }

    /** Parse heading label overrides */
    getHeadingLabels(): Record<string, string> {
        const raw = this.get('headingLabels') as string | null;
        if (!raw) return {};
        try {
            return JSON.parse(raw) as Record<string, string>;
        } catch {
            return {};
        }
    }

    /** Get all saved resumes for a given user */
    static async forUser(userId: string) {
        return this.where({ userId });
    }
}
