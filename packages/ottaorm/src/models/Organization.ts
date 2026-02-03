// ============================================================
// @ottabase/ottaorm - Organization (Tenant) model
// ============================================================

import { eq, and, sql } from 'drizzle-orm';
import { BaseModel, type PackageType, type ModelFields } from '../base/BaseModel';
import { organizationsTable, type OrganizationType, type NewOrganizationType } from './Organization.schema';
import { getConnection } from '../context';

/**
 * Organization (Tenant) model
 * Top-level entity for multi-tenant SaaS
 */
export class Organization extends BaseModel {
    static entity = 'organizations';
    static table = organizationsTable;
    static primaryKey = 'id';
    static connection = 'default';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    // UI/Forms metadata
    static displayName = 'Organization';
    static displayNamePlural = 'Organizations';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
        settings: 'json' as const,
        metadata: 'json' as const,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'ID',
                description: 'Unique organization identifier',
            },
            tableConfig: {
                visible: true,
            },
        },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Name',
                description: 'Organization name',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
                placeholder: 'Enter organization name',
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required|min:2|max:100',
                messages: {
                    required: 'Organization name is required',
                    min: 'Name must be at least 2 characters',
                    max: 'Name cannot exceed 100 characters',
                },
            },
        },
        slug: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Slug',
                description: 'URL-friendly identifier',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
                placeholder: 'organization-slug',
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required|min:2|max:50|alpha_dash',
                messages: {
                    required: 'Slug is required',
                    alpha_dash: 'Slug can only contain letters, numbers, dashes and underscores',
                },
            },
        },
        ownerId: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Owner',
                description: 'Organization owner user ID',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: false,
            },
        },
        plan: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Plan',
                description: 'Subscription plan',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: [
                    { id: 'free', name: 'Free' },
                    { id: 'pro', name: 'Pro' },
                    { id: 'enterprise', name: 'Enterprise' },
                ],
            },
            tableConfig: {
                visible: true,
            },
        },
        status: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Status',
                description: 'Organization status',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: [
                    { id: 'active', name: 'Active' },
                    { id: 'suspended', name: 'Suspended' },
                    { id: 'cancelled', name: 'Cancelled' },
                ],
            },
            tableConfig: {
                visible: true,
            },
        },
        settings: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Settings',
                description: 'Organization settings (JSON)',
            },
            formConfig: {
                visible: false,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: false,
            },
        },
        metadata: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Metadata',
                description: 'Additional metadata (JSON)',
            },
            formConfig: {
                visible: false,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: false,
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Created At',
            },
            tableConfig: {
                visible: true,
            },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Updated At',
            },
            tableConfig: {
                visible: false,
            },
        },
    };

    /**
     * Create a new organization
     */
    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: any,
    ): Promise<InstanceType<T>> {
        // Generate slug from name if not provided
        if (!data.slug && data.name) {
            data.slug = Organization.generateSlug(data.name);
        }

        // Call parent create method
        return (await super.create.call(this, data, driver)) as InstanceType<T>;
    }

    /**
     * Find organization by slug
     */
    static async findBySlug(slug: string): Promise<OrganizationType | undefined> {
        const db = getConnection(this.connection);

        const [organization] = await db
            .select()
            .from(organizationsTable)
            .where(eq(organizationsTable.slug, slug))
            .limit(1);

        return organization;
    }

    /**
     * Update organization
     */
    static async update<T extends typeof BaseModel>(
        this: T,
        id: string,
        data: Record<string, any>,
        driver?: any,
    ): Promise<InstanceType<T>> {
        // Update updatedAt timestamp
        data.updatedAt = new Date();

        // Call parent update method
        return (await super.update.call(this, id, data, driver)) as InstanceType<T>;
    }

    /**
     * Update organization settings
     */
    static async updateSettings(id: string, settings: Record<string, any>): Promise<Organization> {
        return (await this.update(id, { settings })) as Organization;
    }

    /**
     * Update organization status
     */
    static async updateStatus(id: string, status: 'active' | 'suspended' | 'cancelled'): Promise<Organization> {
        return (await this.update(id, { status })) as Organization;
    }

    /**
     * Get organization member count
     */
    static async getMemberCount(id: string): Promise<number> {
        const db = getConnection(this.connection);

        const result = await db.execute(sql`
            SELECT COUNT(*) as count
            FROM organization_members
            WHERE organization_id = ${id}
        `);

        return Number(result.rows[0]?.count || 0);
    }

    /**
     * Check if organization is active
     */
    static async isActive(id: string): Promise<boolean> {
        const org = await this.find(id);
        return org?.get('status') === 'active';
    }

    /**
     * Generate URL-friendly slug from name
     */
    private static generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * Get all active organizations
     */
    static async getActive(limit?: number): Promise<OrganizationType[]> {
        const db = getConnection(this.connection);

        let query = db
            .select()
            .from(organizationsTable)
            .where(eq(organizationsTable.status, 'active'))
            .orderBy(organizationsTable.createdAt);

        if (limit) {
            query = query.limit(limit) as any;
        }

        return query;
    }

    /**
     * Search organizations by name or slug
     */
    static async search(query: string, limit: number = 20): Promise<OrganizationType[]> {
        const db = getConnection(this.connection);

        const searchPattern = `%${query}%`;

        return db
            .select()
            .from(organizationsTable)
            .where(
                sql`${organizationsTable.name} LIKE ${searchPattern} OR ${organizationsTable.slug} LIKE ${searchPattern}`,
            )
            .limit(limit);
    }
}

export { organizationsTable, type OrganizationType, type NewOrganizationType };
