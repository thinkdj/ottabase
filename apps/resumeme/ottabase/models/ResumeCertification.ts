// ============================================================
// ResumeCertification Model (App-specific)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { resumeCertificationsTable } from './ResumeCertification.schema';

export {
    resumeCertificationsTable,
    type NewResumeCertificationType,
    type ResumeCertificationType,
} from './ResumeCertification.schema';

/**
 * ResumeCertification model — stores professional certifications and credentials.
 *
 * @example
 * ```typescript
 * import { ResumeCertification } from "./models/ResumeCertification";
 * import { setDriver } from "@ottabase/ottaorm";
 *
 * setDriver(createD1Driver(env.DB));
 *
 * // Create certification
 * const cert = await ResumeCertification.create({
 *   userId: "user-123",
 *   name: "AWS Solutions Architect",
 *   issuer: "Amazon Web Services",
 *   issueDate: "2024-01",
 *   credentialUrl: "https://aws.amazon.com/verify/...",
 * });
 *
 * // Get all certifications for a user
 * const certs = await ResumeCertification.forUser("user-123");
 * ```
 */
export class ResumeCertification extends BaseModel {
    static entity = 'resume_certifications';
    static table = resumeCertificationsTable;
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
                description: 'Certification owner',
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
                label: 'Certification',
                description: 'Name of the certification',
                placeholder: 'e.g. AWS Solutions Architect',
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
                    required: 'Certification name is required',
                },
            },
        },
        issuer: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Issuer',
                description: 'Issuing Organization',
                placeholder: 'e.g. Amazon Web Services',
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
                    required: 'Issuer is required',
                },
            },
        },
        issueDate: {
            type: 'string',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Issue Date',
                description: 'When the certification was issued (YYYY-MM)',
                placeholder: '2024-01',
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
        expiryDate: {
            type: 'string',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Expiry Date',
                description: 'When the certification expires (YYYY-MM)',
                placeholder: '2027-01',
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
        credentialUrl: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Credential URL',
                description: 'Verification link for the credential',
                placeholder: 'https://verify.example.com/...',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
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
            fieldName: 'Certification',
            messages: {
                required: 'Certification name is required',
            },
        },
        issuer: {
            rules: 'required',
            fieldName: 'Issuer',
            messages: {
                required: 'Issuer is required',
            },
        },
    };

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /** Get all certifications for a given user */
    static async forUser(userId: string) {
        return this.where({ userId });
    }
}
