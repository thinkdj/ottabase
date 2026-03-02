// ============================================================
// ResumeApplicationDossierFile Model (App-specific)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { resumeApplicationDossierFilesTable } from './ResumeApplicationDossierFile.schema';

export {
    resumeApplicationDossierFilesTable,
    type NewResumeApplicationDossierFileType,
    type ResumeApplicationDossierFileType,
} from './ResumeApplicationDossierFile.schema';

/**
 * ResumeApplicationDossierFile model — a file uploaded to an application dossier folder.
 *
 * Files are stored in R2 and optionally have their text extracted for AI
 * processing. Supported types include PDF, TXT, DOCX, and images.
 *
 * @example
 * ```typescript
 * const file = await ResumeApplicationDossierFile.create({
 *     userId: 'user-123',
 *     dossierApplicationId: 'dossier-abc',
 *     fileName: 'resume.pdf',
 *     fileType: 'pdf',
 *     mimeType: 'application/pdf',
 *     fileSize: 204800,
 *     r2Key: 'uploads/user-123/resume.pdf',
 * });
 * ```
 */
export class ResumeApplicationDossierFile extends BaseModel {
    static entity = 'resume_application_dossier_files';
    static table = resumeApplicationDossierFilesTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        fileSize: 'number' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        status: 'uploaded',
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
                description: 'File owner',
            },
            formConfig: { visible: true, fieldType: 'select' },
            tableConfig: { visible: false },
        },
        dossierApplicationId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Application Dossier',
                description: 'Parent application dossier',
            },
            formConfig: { visible: true, fieldType: 'select' },
            tableConfig: { visible: false },
        },
        fileName: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'File Name',
                description: 'Original file name',
                placeholder: 'e.g. resume.pdf',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
            validation: {
                rules: 'required',
                messages: { required: 'File name is required' },
            },
        },
        fileType: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'File Type',
                description: 'File type (pdf, txt, image, docx)',
            },
            formConfig: { visible: true, fieldType: 'select' },
            tableConfig: { visible: true, colWidth: 100 },
        },
        mimeType: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'MIME Type',
                description: 'File MIME type',
            },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        fileSize: {
            type: 'number',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'File Size',
                description: 'Size in bytes',
            },
            formConfig: { visible: false },
            tableConfig: { visible: true, colWidth: 100 },
        },
        r2Key: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'R2 Key',
                description: 'R2 storage key',
            },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        extractedText: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Extracted Text',
                description: 'Text extracted from file for AI processing',
            },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        status: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Status',
                description: 'Processing status',
                defaultValue: 'uploaded',
            },
            formConfig: { visible: true, fieldType: 'select' },
            tableConfig: { visible: true, colWidth: 110 },
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
        fileName: {
            rules: 'required',
            fieldName: 'File Name',
            messages: { required: 'File name is required' },
        },
    };

    // ── Convenience ──────────────────────────────────────────

    /** Get all files for a given application dossier */
    static async forDossier(dossierApplicationId: string) {
        return this.where({ dossierApplicationId });
    }

    /** Get all files for a given user */
    static async forUser(userId: string) {
        return this.where({ userId });
    }
}
