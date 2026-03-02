// ============================================================
// ResumeApplicationDossier Model (App-specific)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { resumeApplicationDossiersTable } from './ResumeApplicationDossier.schema';

export {
    resumeApplicationDossiersTable,
    type NewResumeApplicationDossierType,
    type ResumeApplicationDossierType,
} from './ResumeApplicationDossier.schema';

/**
 * ResumeApplicationDossier model — a "folder" for grouping related documents around a
 * specific job application context (like NotebookLM).
 *
 * @example
 * ```typescript
 * const dossier = await ResumeApplicationDossier.create({
 *     userId: 'user-123',
 *     name: 'Google SWE Application',
 *     targetRole: 'Senior Software Engineer',
 *     targetCompany: 'Google',
 * });
 *
 * const result = dossier.getAnalysisResult<{ score: number }>();
 * ```
 */
export class ResumeApplicationDossier extends BaseModel {
    static entity = 'resume_application_dossiers';
    static table = resumeApplicationDossiersTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        lastAnalysisAt: 'date' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        status: 'active',
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
                description: 'Application dossier owner',
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
                description: 'Application dossier name',
                placeholder: 'e.g. Google SWE Application',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
            validation: {
                rules: 'required',
                messages: { required: 'Name is required' },
            },
        },
        description: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Description',
                description: 'Brief description of this application dossier',
                placeholder: 'e.g. Documents for my Google application',
            },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        targetRole: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Target Role',
                description: 'Role being applied for',
                placeholder: 'e.g. Senior Frontend Engineer',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 200 },
        },
        targetCompany: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Target Company',
                description: 'Company being applied to',
                placeholder: 'e.g. Google',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 160 },
        },
        status: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Status',
                description: 'Application dossier status',
                defaultValue: 'active',
            },
            formConfig: { visible: true, fieldType: 'select' },
            tableConfig: { visible: true, colWidth: 100 },
        },
        lastAnalysisAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Last Analysis' },
            tableConfig: { visible: false },
        },
        analysisResult: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Analysis Result',
                description: 'JSON AI analysis result',
            },
            formConfig: { visible: false },
            tableConfig: { visible: false },
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

    /** Parse the stored AI analysis result JSON */
    getAnalysisResult<T = unknown>(): T | null {
        const raw = this.get('analysisResult') as string | null;
        if (!raw) return null;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    }

    /** Serialise and store an AI analysis result */
    setAnalysisResult(data: unknown): void {
        this.set('analysisResult', JSON.stringify(data));
        this.set('lastAnalysisAt', Date.now());
    }

    /** Get all application dossiers for a given user */
    static async forUser(userId: string) {
        return this.where({ userId });
    }
}
