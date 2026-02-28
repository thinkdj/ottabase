// ============================================================
// ResumeProfile Model (App-specific)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { resumeProfilesTable, type NewResumeProfileType, type ResumeProfileType } from './ResumeProfile.schema';

export { resumeProfilesTable, type NewResumeProfileType, type ResumeProfileType } from './ResumeProfile.schema';

/**
 * ResumeProfile model — stores professional profile info for a user.
 * Name comes from the users table; this holds headline, contact, and links.
 *
 * @example
 * ```typescript
 * import { ResumeProfile } from "./models/ResumeProfile";
 * import { setDriver } from "@ottabase/ottaorm";
 *
 * setDriver(createD1Driver(env.DB));
 *
 * // Create profile
 * const profile = await ResumeProfile.create({
 *   userId: "user-123",
 *   headline: "Full-Stack Engineer",
 *   email: "dev@example.com",
 * });
 *
 * // Find profile by user
 * const userProfile = await ResumeProfile.forUser("user-123");
 * ```
 */
export class ResumeProfile extends BaseModel {
    static entity = 'resume_profiles';
    static table = resumeProfilesTable;
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
                description: 'Profile owner',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: false,
            },
        },
        headline: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Headline',
                description: 'Professional headline or tagline',
                placeholder: 'e.g. Full-Stack Engineer',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 'auto',
            },
        },
        summary: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Summary',
                description: 'Brief professional summary',
                placeholder: 'A short paragraph about your experience',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: false,
            },
        },
        avatarUrl: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Avatar URL',
                description: 'Profile photo URL',
                placeholder: 'https://example.com/avatar.jpg',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: false,
            },
        },
        phone: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Phone',
                description: 'Contact phone number',
                placeholder: '+1 555-000-0000',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: false,
            },
        },
        email: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Email',
                description: 'Contact email address',
                placeholder: 'you@example.com',
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
        website: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Website',
                description: 'Personal website or portfolio URL',
                placeholder: 'https://yoursite.com',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: false,
            },
        },
        linkedinUrl: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'LinkedIn URL',
                description: 'LinkedIn profile link',
                placeholder: 'https://linkedin.com/in/yourname',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: false,
            },
        },
        githubUrl: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'GitHub URL',
                description: 'GitHub profile link',
                placeholder: 'https://github.com/yourname',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: false,
            },
        },
        location: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Location',
                description: 'City, state, or country',
                placeholder: 'San Francisco, CA',
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
        userId: {
            rules: 'required',
            fieldName: 'User',
            messages: {
                required: 'User ID is required',
            },
        },
    };

    // ============================================================
    // RELATIONSHIPS
    // ============================================================

    /** Get the user who owns this profile (BelongsTo User) */
    async user(select?: string[]) {
        const { User } = await import('@ottabase/ottaorm');

        return this.belongsTo(User, 'userId', {
            select: select || ['id', 'name', 'email'],
        });
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /** Find the resume profile for a given user */
    static async forUser(userId: string) {
        return this.first({ userId });
    }
}
