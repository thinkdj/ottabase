// ============================================================
// @ottabase/ottaorm - OrganizationMember model
// ============================================================

import { eq, and, sql } from 'drizzle-orm';
import { BaseModel, type PackageType, type ModelFields } from '../base/BaseModel';
import {
    organizationMembersTable,
    type OrganizationMemberType,
    type NewOrganizationMemberType,
} from './OrganizationMember.schema';
import { getConnection } from '../context';
import { usersTable } from './User.schema';
import { organizationsTable } from './Organization.schema';

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
        const db = getConnection(this.connection);

        const [member] = await db
            .insert(organizationMembersTable)
            .values({
                ...data,
                joinedAt: data.joinedAt || new Date(),
            })
            .returning();

        return member;
    }

    /**
     * Remove a user from an organization
     */
    static async removeMember(userId: string, organizationId: string): Promise<boolean> {
        const db = getConnection(this.connection);

        const result = await db
            .delete(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                ),
            );

        return true;
    }

    /**
     * Update member role in organization
     */
    static async updateRole(
        userId: string,
        organizationId: string,
        role: 'owner' | 'admin' | 'member',
    ): Promise<OrganizationMemberType | undefined> {
        const db = getConnection(this.connection);

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
        const db = getConnection(this.connection);

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
        },
    ): Promise<Array<OrganizationMemberType & { user?: any }>> {
        const db = getConnection(this.connection);

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
            .where(and(...conditions));

        if (options?.limit) {
            query = query.limit(options.limit) as any;
        }

        return query;
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
        const db = getConnection(this.connection);

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
        const db = getConnection(this.connection);

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
        const db = getConnection(this.connection);

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
        const db = getConnection(this.connection);

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
        const db = getConnection(this.connection);

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

export { organizationMembersTable, type OrganizationMemberType, type NewOrganizationMemberType };
