// ============================================================
// @ottabase/ottaorm - OrganizationMember model
// ============================================================

import { and, desc, eq, sql } from 'drizzle-orm';
import { BaseModel, type ModelFields, type PackageType } from '../base/BaseModel';
import { DEFAULT_ROLE_NAMES, type DefaultRoleName } from './DefaultRoles';
import type { RBACCacheLike } from './Organization';
import { organizationsTable } from './Organization.schema';
import {
    organizationMembersTable,
    type NewOrganizationMemberType,
    type OrganizationMemberType,
} from './OrganizationMember.schema';
import { usersTable } from './User.schema';

export type MembershipRole = DefaultRoleName;
export type MembershipStatus = 'active' | 'invited' | 'suspended';

/**
 * Codes raised by OrganizationMember lifecycle methods. Routes map these
 * directly to HTTP responses instead of reimplementing the guard logic.
 */
export type MembershipErrorCode =
    | 'LAST_ACTIVE_OWNER_GUARD'
    | 'USER_NOT_FOUND'
    | 'MEMBER_NOT_FOUND'
    | 'MEMBER_ALREADY_EXISTS';

export class MembershipError extends Error {
    public readonly code: MembershipErrorCode;

    constructor(code: MembershipErrorCode, message?: string) {
        super(message ?? code);
        this.name = 'MembershipError';
        this.code = code;
    }
}

interface AddMemberOptions {
    userId: string;
    organizationId: string;
    role: MembershipRole;
    status?: MembershipStatus;
    invitedBy?: string | null;
    invitedAt?: number | null;
    joinedAt?: number;
    metadata?: Record<string, unknown> | null;
    cache?: RBACCacheLike;
}

interface LifecycleOptions {
    cache?: RBACCacheLike;
    assignedBy?: string | null;
}

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
                    { id: 'viewer', name: 'Viewer' },
                ],
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required|in:owner,admin,member,viewer',
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
     * Add a user to an organization and sync RBAC in one call.
     *
     * - Creates the membership row (or refuses if one already exists).
     * - When status='active', assigns the matching default role via
     *   `syncTenantRBAC`. Invited/suspended members get no RBAC until activated.
     * - Invalidates the RBAC cache when `cache` is provided so the next
     *   request sees the change without waiting for TTL.
     */
    static async addMember(options: AddMemberOptions): Promise<OrganizationMemberType> {
        const userId = String(options.userId || '').trim();
        const organizationId = String(options.organizationId || '').trim();
        if (!userId) throw new MembershipError('USER_NOT_FOUND', 'userId is required');
        if (!organizationId) throw new Error('organizationId is required');
        if (!DEFAULT_ROLE_NAMES.includes(options.role)) {
            throw new Error(`Unknown membership role: ${options.role}`);
        }

        // Guard at the model layer so callers that bypass the route layer still
        // get a well-typed MembershipError instead of an opaque D1 UNIQUE violation.
        const existing = await this.getMember(userId, organizationId);
        if (existing) {
            throw new MembershipError('MEMBER_ALREADY_EXISTS');
        }

        const status = options.status ?? 'invited';
        const joinedAt = Number.isFinite(options.joinedAt) ? Number(options.joinedAt) : Date.now();
        const invitedAt =
            options.invitedAt === null || options.invitedAt === undefined
                ? null
                : Number.isFinite(options.invitedAt)
                  ? Number(options.invitedAt)
                  : null;

        let member: OrganizationMemberType;
        try {
            const db = this.getDriver().getDb();
            const [created] = await db
                .insert(organizationMembersTable)
                .values({
                    userId,
                    organizationId,
                    role: options.role,
                    status,
                    invitedBy: options.invitedBy ?? null,
                    invitedAt,
                    joinedAt,
                    metadata: options.metadata ?? null,
                } as NewOrganizationMemberType)
                .returning();
            member = created;
        } catch (error) {
            // Race-safe duplicate handling: two concurrent callers may pass the
            // pre-insert existence check and collide on the composite PK insert.
            if (this.isDuplicateMembershipInsertError(error)) {
                throw new MembershipError('MEMBER_ALREADY_EXISTS');
            }
            throw error;
        }

        await this.syncTenantRBAC(userId, organizationId, options.role, status, {
            cache: options.cache,
            assignedBy: options.invitedBy ?? null,
        });

        return member;
    }

    private static isDuplicateMembershipInsertError(error: unknown): boolean {
        if (!error) return false;
        const message = error instanceof Error ? error.message : String(error);
        return /unique|constraint|already exists|organization_members/i.test(message);
    }

    /**
     * Change an existing member's role and re-sync RBAC atomically.
     *
     * Throws `MembershipError('LAST_ACTIVE_OWNER_GUARD')` when demoting the
     * only remaining active owner — routes catch this and map to 409.
     */
    static async setRole(
        userId: string,
        organizationId: string,
        role: MembershipRole,
        options: LifecycleOptions = {},
    ): Promise<OrganizationMemberType> {
        if (!DEFAULT_ROLE_NAMES.includes(role)) {
            throw new Error(`Unknown membership role: ${role}`);
        }

        const current = await this.getMember(userId, organizationId);
        if (!current) {
            throw new MembershipError('MEMBER_NOT_FOUND');
        }

        if (role !== 'owner' && current.role === 'owner' && current.status === 'active') {
            if (await this.isLastActiveOwner(userId, organizationId)) {
                throw new MembershipError('LAST_ACTIVE_OWNER_GUARD');
            }
        }

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

        const status = (updated?.status ?? current.status) as MembershipStatus;
        await this.syncTenantRBAC(userId, organizationId, role, status, options);
        return updated ?? { ...current, role };
    }

    /**
     * Change an existing member's status and re-sync RBAC. Used primarily to
     * accept invites (invited → active) or suspend a member.
     */
    static async setStatus(
        userId: string,
        organizationId: string,
        status: MembershipStatus,
        options: LifecycleOptions = {},
    ): Promise<OrganizationMemberType> {
        const current = await this.getMember(userId, organizationId);
        if (!current) {
            throw new MembershipError('MEMBER_NOT_FOUND');
        }

        if (status !== 'active' && current.role === 'owner' && current.status === 'active') {
            if (await this.isLastActiveOwner(userId, organizationId)) {
                throw new MembershipError('LAST_ACTIVE_OWNER_GUARD');
            }
        }

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

        const role = (updated?.role ?? current.role) as MembershipRole;
        await this.syncTenantRBAC(userId, organizationId, role, status, options);
        return updated ?? { ...current, status };
    }

    /**
     * Remove a user from an organization, tearing down RBAC and guarding
     * against demoting the last active owner.
     */
    static async removeMember(
        userId: string,
        organizationId: string,
        options: LifecycleOptions = {},
    ): Promise<boolean> {
        const current = await this.getMember(userId, organizationId);
        if (!current) return false;

        if (current.role === 'owner' && current.status === 'active') {
            if (await this.isLastActiveOwner(userId, organizationId)) {
                throw new MembershipError('LAST_ACTIVE_OWNER_GUARD');
            }
        }

        // Strip all tenant-scoped RBAC first — if this fails, the membership
        // row is still intact and the caller can retry.
        await this.clearTenantRBAC(userId, organizationId);

        const db = this.getDriver().getDb();
        await db
            .delete(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                ),
            );

        if (options.cache) {
            try {
                await options.cache.invalidateUser(userId, organizationId);
            } catch {
                // ignore — cache will expire naturally
            }
        }

        return true;
    }

    /**
     * Internal: drop every default-role assignment for (user, org) and then —
     * when status='active' — assign the single matching role. Keeps the
     * `user_roles` junction in lockstep with `organization_members.role`.
     *
     * When status is NOT 'active' (i.e. suspended or invited), all custom
     * org-scoped roles are also removed via a bulk DELETE to ensure a suspended
     * or de-listed member cannot continue to exercise permissions granted by
     * custom roles they were assigned while active.
     */
    static async syncTenantRBAC(
        userId: string,
        organizationId: string,
        role: MembershipRole,
        status: MembershipStatus,
        options: LifecycleOptions = {},
    ): Promise<void> {
        const { Role } = await import('./Role');
        const { UserRole } = await import('./UserRole');
        const defaults = await Role.ensureDefaults();

        if (status !== 'active') {
            // Member is being suspended or invited — remove ALL org-scoped role
            // assignments (both default and custom) in a single bulk DELETE so no
            // permission can survive the status change.
            await UserRole.clearUserRoles(userId, organizationId);
        } else {
            // Member is (re-)activating — only revoke the four default roles so
            // that the correct one can be re-assigned below. Custom roles are NOT
            // touched on activation; they must be re-granted explicitly by an admin.
            for (const name of DEFAULT_ROLE_NAMES) {
                const target = defaults[name];
                if (!target) continue;
                await UserRole.removeRole(userId, String(target.get('id')), organizationId);
            }
        }

        if (status === 'active') {
            const target = defaults[role];
            if (!target) {
                throw new Error(`Role ${role} not found for tenant RBAC sync`);
            }
            await UserRole.create({
                userId,
                roleId: String(target.get('id')),
                organizationId,
                appId: null,
                assignedBy: options.assignedBy ?? null,
            } as Record<string, unknown>);
        }

        if (options.cache) {
            try {
                await options.cache.invalidateUser(userId, organizationId);
            } catch {
                // cache failures don't fail the write
            }
        }
    }

    /**
     * Internal: remove ALL role assignments (default + custom) for (user, org)
     * without reassigning. Called by `removeMember` so a deleted member leaves
     * no RBAC residue — neither their base membership role nor any extra custom
     * roles they were granted via the RBAC user-roles API.
     *
     * Uses a single bulk DELETE query to avoid N+1 round-trips.
     */
    private static async clearTenantRBAC(userId: string, organizationId: string): Promise<void> {
        const { UserRole } = await import('./UserRole');
        await UserRole.clearUserRoles(userId, organizationId);
    }

    /**
     * Get all members of an organization
     */
    static async getOrganizationMembers(
        organizationId: string,
        options?: {
            status?: 'active' | 'invited' | 'suspended';
            role?: 'owner' | 'admin' | 'member' | 'viewer';
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
            role?: 'owner' | 'admin' | 'member' | 'viewer';
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
            role?: 'owner' | 'admin' | 'member' | 'viewer';
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
    static async hasRole(
        userId: string,
        organizationId: string,
        role: 'owner' | 'admin' | 'member' | 'viewer',
    ): Promise<boolean> {
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
