// ============================================================
// @ottabase/ottaorm - OrganizationMember model
// ============================================================

import { and, desc, eq, sql } from 'drizzle-orm';
import { BaseModel, type ModelFields, type PackageType } from '../base/BaseModel';
import { organizationsTable } from './Organization.schema';
import {
    organizationMembersTable,
    type NewOrganizationMemberType,
    type OrganizationMemberType,
} from './OrganizationMember.schema';
import { usersTable } from './User.schema';

/**
 * OrganizationMember model
 * Manages user membership in organizations
 */
export class OrganizationMember extends BaseModel {
    static entity = 'organization_members';
    static table = organizationMembersTable;
    static primaryKey = 'userId'; // Composite key, but we'll use userId as primary
    static connection = 'default';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    // UI/Forms metadata
    static displayName = 'Organization Member';
    static displayNamePlural = 'Organization Members';
    static defaultSort = 'joinedAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        joinedAt: 'date' as const,
        invitedAt: 'date' as const,
        metadata: 'json' as const,
    };

    protected static fields: ModelFields = {
        userId: {
            type: 'string',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'User ID',
            },
            tableConfig: {
                visible: true,
            },
        },
        organizationId: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Organization ID',
            },
            tableConfig: {
                visible: true,
            },
        },
        role: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Role',
                description: 'Member role in organization',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: [
                    { id: 'owner', name: 'Owner' },
                    { id: 'admin', name: 'Admin' },
                    { id: 'member', name: 'Member' },
                ],
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required|in:owner,admin,member',
                messages: {
                    required: 'Role is required',
                    in: 'Invalid role',
                },
            },
        },
        status: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Status',
                description: 'Membership status',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: [
                    { id: 'active', name: 'Active' },
                    { id: 'invited', name: 'Invited' },
                    { id: 'suspended', name: 'Suspended' },
                ],
            },
            tableConfig: {
                visible: true,
            },
        },
        invitedBy: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Invited By',
            },
            tableConfig: {
                visible: false,
            },
        },
        invitedAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Invited At',
            },
            tableConfig: {
                visible: false,
            },
        },
        joinedAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Joined At',
            },
            tableConfig: {
                visible: true,
            },
        },
        metadata: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Metadata',
            },
            tableConfig: {
                visible: false,
            },
        },
    };

    /**
     * Add a user to an organization
     */
    static async addMember(data: NewOrganizationMemberType): Promise<OrganizationMemberType> {
        const db = this.getDriver().getDb();

        const [member] = await db
            .insert(organizationMembersTable)
            .values({
                ...data,
                joinedAt: data.joinedAt || Date.now(),
            })
            .returning();

        return member;
    }

    /**
     * Create a member row and return a model instance.
     *
     * Thin typed wrapper around BaseModel.create so route code can pass a
     * properly typed payload without resorting to `as any`. Use this instead
     * of calling BaseModel.create directly for membership inserts.
     */
    static async createMember(data: NewOrganizationMemberType): Promise<OrganizationMember> {
        return (await this.create(data as unknown as Record<string, unknown>)) as OrganizationMember;
    }

    /**
     * Remove a user from an organization
     */
    static async removeMember(userId: string, organizationId: string): Promise<boolean> {
        const db = this.getDriver().getDb();

        await db
            .delete(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                ),
            );

        const [remaining] = await db
            .select({ count: sql<number>`count(*)` })
            .from(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                ),
            );

        return Number(remaining?.count ?? 0) === 0;
    }

    /**
     * Update member role in organization
     */
    static async updateRole(
        userId: string,
        organizationId: string,
        role: 'owner' | 'admin' | 'member',
    ): Promise<OrganizationMemberType | undefined> {
        const db = this.getDriver().getDb();

        const [updated] = await db
            .update(organizationMembersTable)
            .set({ role })
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                ),
            )
            .returning();

        return updated;
    }

    /**
     * Update member status
     */
    static async updateStatus(
        userId: string,
        organizationId: string,
        status: 'active' | 'invited' | 'suspended',
    ): Promise<OrganizationMemberType | undefined> {
        const db = this.getDriver().getDb();

        const [updated] = await db
            .update(organizationMembersTable)
            .set({ status })
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                ),
            )
            .returning();

        return updated;
    }

    /**
     * Get all members of an organization
     */
    static async getOrganizationMembers(
        organizationId: string,
        options?: {
            status?: 'active' | 'invited' | 'suspended';
            role?: 'owner' | 'admin' | 'member';
            limit?: number;
            /** Zero-based row offset for pagination */
            offset?: number;
        },
    ): Promise<Array<OrganizationMemberType & { user?: any }>> {
        const db = this.getDriver().getDb();

        let conditions = [eq(organizationMembersTable.organizationId, organizationId)];

        if (options?.status) {
            conditions.push(eq(organizationMembersTable.status, options.status));
        }

        if (options?.role) {
            conditions.push(eq(organizationMembersTable.role, options.role));
        }

        let query = db
            .select({
                userId: organizationMembersTable.userId,
                organizationId: organizationMembersTable.organizationId,
                role: organizationMembersTable.role,
                status: organizationMembersTable.status,
                invitedBy: organizationMembersTable.invitedBy,
                invitedAt: organizationMembersTable.invitedAt,
                joinedAt: organizationMembersTable.joinedAt,
                metadata: organizationMembersTable.metadata,
                user: {
                    id: usersTable.id,
                    name: usersTable.name,
                    email: usersTable.email,
                    image: usersTable.image,
                },
            })
            .from(organizationMembersTable)
            .leftJoin(usersTable, eq(organizationMembersTable.userId, usersTable.id))
            .where(and(...conditions))
            .orderBy(desc(organizationMembersTable.joinedAt), desc(organizationMembersTable.userId));

        if (options?.limit) {
            query = query.limit(options.limit) as any;
        }

        if (options?.offset !== undefined) {
            query = query.offset(options.offset) as any;
        }

        return query;
    }

    /**
     * Count all members of an organization (for pagination totals).
     * Supports the same status/role filters as getOrganizationMembers.
     */
    static async countOrganizationMembers(
        organizationId: string,
        options?: {
            status?: 'active' | 'invited' | 'suspended';
            role?: 'owner' | 'admin' | 'member';
        },
    ): Promise<number> {
        const db = this.getDriver().getDb();

        const conditions = [eq(organizationMembersTable.organizationId, organizationId)];

        if (options?.status) {
            conditions.push(eq(organizationMembersTable.status, options.status));
        }

        if (options?.role) {
            conditions.push(eq(organizationMembersTable.role, options.role));
        }

        const [result] = await db
            .select({ count: sql<number>`count(*)` })
            .from(organizationMembersTable)
            .where(and(...conditions));

        return Number(result?.count ?? 0);
    }

    /**
     * Count active owners in an organization.
     */
    static async countActiveOwners(organizationId: string): Promise<number> {
        return this.countOrganizationMembers(organizationId, {
            role: 'owner',
            status: 'active',
        });
    }

    /**
     * True when the target member is the only active owner in the organization.
     */
    static async isLastActiveOwner(userId: string, organizationId: string): Promise<boolean> {
        const [isOwner, ownerCount] = await Promise.all([
            this.hasRole(userId, organizationId, 'owner'),
            this.countActiveOwners(organizationId),
        ]);

        return isOwner && ownerCount <= 1;
    }

    /**
     * Get all organizations for a user
     */
    static async getUserOrganizations(
        userId: string,
        options?: {
            status?: 'active' | 'invited' | 'suspended';
            role?: 'owner' | 'admin' | 'member';
        },
    ): Promise<Array<OrganizationMemberType & { organization?: any }>> {
        const db = this.getDriver().getDb();

        let conditions = [eq(organizationMembersTable.userId, userId)];

        if (options?.status) {
            conditions.push(eq(organizationMembersTable.status, options.status));
        }

        if (options?.role) {
            conditions.push(eq(organizationMembersTable.role, options.role));
        }

        return db
            .select({
                userId: organizationMembersTable.userId,
                organizationId: organizationMembersTable.organizationId,
                role: organizationMembersTable.role,
                status: organizationMembersTable.status,
                invitedBy: organizationMembersTable.invitedBy,
                invitedAt: organizationMembersTable.invitedAt,
                joinedAt: organizationMembersTable.joinedAt,
                metadata: organizationMembersTable.metadata,
                organization: {
                    id: organizationsTable.id,
                    name: organizationsTable.name,
                    slug: organizationsTable.slug,
                    plan: organizationsTable.plan,
                    status: organizationsTable.status,
                },
            })
            .from(organizationMembersTable)
            .leftJoin(organizationsTable, eq(organizationMembersTable.organizationId, organizationsTable.id))
            .where(and(...conditions));
    }

    /**
     * Check if user is member of organization
     */
    static async isMember(userId: string, organizationId: string): Promise<boolean> {
        const db = this.getDriver().getDb();

        const [member] = await db
            .select()
            .from(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                    eq(organizationMembersTable.status, 'active'),
                ),
            )
            .limit(1);

        return !!member;
    }

    /**
     * Check if user has specific role in organization
     */
    static async hasRole(userId: string, organizationId: string, role: 'owner' | 'admin' | 'member'): Promise<boolean> {
        const db = this.getDriver().getDb();

        const [member] = await db
            .select()
            .from(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                    eq(organizationMembersTable.role, role),
                    eq(organizationMembersTable.status, 'active'),
                ),
            )
            .limit(1);

        return !!member;
    }

    /**
     * Check if user is owner or admin
     */
    static async isOwnerOrAdmin(userId: string, organizationId: string): Promise<boolean> {
        const db = this.getDriver().getDb();

        const [member] = await db
            .select()
            .from(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                    eq(organizationMembersTable.status, 'active'),
                    sql`${organizationMembersTable.role} IN ('owner', 'admin')`,
                ),
            )
            .limit(1);

        return !!member;
    }

    /**
     * Get member details
     */
    static async getMember(userId: string, organizationId: string): Promise<OrganizationMemberType | undefined> {
        const db = this.getDriver().getDb();

        const [member] = await db
            .select()
            .from(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                ),
            )
            .limit(1);

        return member;
    }
}

export { organizationMembersTable, type NewOrganizationMemberType, type OrganizationMemberType };
