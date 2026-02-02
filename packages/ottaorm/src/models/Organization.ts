// ============================================================
// @ottabase/ottaorm - Organization (Tenant) model
// ============================================================

import { eq, and, sql } from 'drizzle-orm';
import { BaseModel } from '../base/BaseModel';
import {
    organizationsTable,
    type OrganizationType,
    type NewOrganizationType,
} from './Organization.schema';
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

    /**
     * Create a new organization
     */
    static async create(data: NewOrganizationType): Promise<OrganizationType> {
        const db = getConnection(this.connection);

        // Generate slug from name if not provided
        if (!data.slug && data.name) {
            data.slug = this.generateSlug(data.name);
        }

        const [organization] = await db
            .insert(organizationsTable)
            .values(data)
            .returning();

        return organization;
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
    static async update(
        id: string,
        data: Partial<NewOrganizationType>
    ): Promise<OrganizationType | undefined> {
        const db = getConnection(this.connection);

        const [updated] = await db
            .update(organizationsTable)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(organizationsTable.id, id))
            .returning();

        return updated;
    }

    /**
     * Update organization settings
     */
    static async updateSettings(
        id: string,
        settings: Record<string, any>
    ): Promise<OrganizationType | undefined> {
        return this.update(id, { settings });
    }

    /**
     * Update organization status
     */
    static async updateStatus(
        id: string,
        status: 'active' | 'suspended' | 'cancelled'
    ): Promise<OrganizationType | undefined> {
        return this.update(id, { status });
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
        return org?.status === 'active';
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
                sql`${organizationsTable.name} LIKE ${searchPattern} OR ${organizationsTable.slug} LIKE ${searchPattern}`
            )
            .limit(limit);
    }
}

export { organizationsTable, type OrganizationType, type NewOrganizationType };
