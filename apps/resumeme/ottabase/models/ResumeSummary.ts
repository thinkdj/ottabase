// ============================================================
// ResumeSummary Model (App-specific)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { resumeSummariesTable } from './ResumeSummary.schema';

export { resumeSummariesTable, type NewResumeSummaryType, type ResumeSummaryType } from './ResumeSummary.schema';

/**
 * ResumeSummary model — reusable summary snippets decoupled from profiles.
 */
export class ResumeSummary extends BaseModel {
    static entity = 'resume_summaries';
    static table = resumeSummariesTable;
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
            uiConfig: { label: 'ID' },
        },
        userId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'User',
                description: 'Summary owner',
            },
            formConfig: { visible: true, fieldType: 'select' },
            tableConfig: { visible: false },
        },
        title: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Title',
                description: 'Internal label (e.g. “PM Summary”)',
                placeholder: 'Backend summary',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 220 },
            validation: {
                rules: 'required',
                messages: { required: 'Title is required' },
            },
        },
        content: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Summary Text',
                description: 'Short professional summary or objective',
                placeholder: 'Concise pitch tailored to a role',
            },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
            validation: {
                rules: 'required',
                messages: { required: 'Summary text is required' },
            },
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
        title: {
            rules: 'required',
            fieldName: 'Title',
            messages: { required: 'Title is required' },
        },
        content: {
            rules: 'required',
            fieldName: 'Summary text',
            messages: { required: 'Summary text is required' },
        },
    };

    /** Get all summaries for a user */
    static async forUser(userId: string) {
        return this.where({ userId });
    }
}
