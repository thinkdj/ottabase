// ============================================================
// @ottabase/ottaorm - OrganizationMember model
// ============================================================

import { and, desc, eq, exists, isNull, ne, or, sql } from 'drizzle-orm';
import { alias, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { DbDriver } from '@ottabase/db/drizzle';
import { BaseModel, type ModelFields, type PackageType, type UpdateMutationContext } from '../base/BaseModel';
import { DomainValidationError } from '../validation';
import { organizationsTable } from './Organization.schema';
import {
    organizationMembersTable,
    type NewOrganizationMemberType,
    type OrganizationMemberType,
} from './OrganizationMember.schema';
import { usersTable } from './User.schema';
import { userRolesTable } from './UserRole.schema';

export type OrganizationRosterRole = 'owner' | 'admin' | 'member';
export type OrganizationRosterStatus = 'active' | 'invited' | 'suspended';

export type RosterMembershipChanges =
    | { role: OrganizationRosterRole; status?: OrganizationRosterStatus }
    | { role?: OrganizationRosterRole; status: OrganizationRosterStatus };

export interface RosterMembershipExpected {
    role: OrganizationRosterRole;
    status: OrganizationRosterStatus;
}

export type UpdateRosterMembershipResult =
    | { status: 'updated'; member: OrganizationMemberType }
    | { status: 'not_found' | 'last_active_owner' | 'stale' };

export type RemoveRosterMembershipResult =
    | { status: 'removed' }
    | { status: 'not_found' | 'last_active_owner' | 'stale' };

const ROSTER_ROLE_TIER: Record<OrganizationRosterRole, number> = { owner: 3, admin: 2, member: 1 };

type RosterPredicateColumns = {
    id: AnySQLiteColumn;
    userId: AnySQLiteColumn;
    organizationId: AnySQLiteColumn;
    role: AnySQLiteColumn;
    status: AnySQLiteColumn;
};

function isOrganizationRosterRole(value: unknown): value is OrganizationRosterRole {
    return value === 'owner' || value === 'admin' || value === 'member';
}

function isOrganizationRosterStatus(value: unknown): value is OrganizationRosterStatus {
    return value === 'active' || value === 'invited' || value === 'suspended';
}

function assertMembershipState(data: Record<string, unknown>): void {
    const role = data.role ?? 'member';
    const status = data.status ?? 'active';
    const fieldErrors: Record<string, string> = {};

    if (!isOrganizationRosterRole(role)) fieldErrors.role = 'Role must be owner, admin, or member';
    if (!isOrganizationRosterStatus(status)) fieldErrors.status = 'Status must be active, invited, or suspended';

    const hasUser = typeof data.userId === 'string' ? data.userId.trim().length > 0 : data.userId != null;
    if (!hasUser) {
        if (status !== 'invited' && fieldErrors.status === undefined) {
            fieldErrors.status = 'A membership without a user must remain invited';
        }
        if (typeof data.invitedEmail !== 'string' || data.invitedEmail.trim().length === 0) {
            fieldErrors.invitedEmail = 'An invited email is required when no user is linked';
        }
    } else if (status === 'invited' && fieldErrors.status === undefined) {
        fieldErrors.status = 'A linked user must be active or suspended; pending invites are email-only';
    }

    if (Object.keys(fieldErrors).length > 0) {
        throw new DomainValidationError('Invalid organization membership', {
            code: 'INVALID_ORGANIZATION_MEMBERSHIP',
            fieldErrors,
            status: 422,
        });
    }
}

/**
 * OrganizationMember model
 * Manages user membership in organizations
 */
export class OrganizationMember extends BaseModel {
    static entity = 'organization_members';
    static table = organizationMembersTable;
    static primaryKey = 'id';
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
            tableConfig: {
                visible: true,
            },
        },
        userId: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'User ID',
            },
            tableConfig: {
                visible: true,
            },
        },
        invitedEmail: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Invited Email',
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
            validation: {
                rules: 'required|in:active,invited,suspended',
                messages: {
                    required: 'Status is required',
                    in: 'Invalid status',
                },
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

    /** Enforce cross-field membership identity/lifecycle rules for direct and generic CRUD creates. */
    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: DbDriver,
    ): Promise<InstanceType<T>> {
        assertMembershipState(data);
        return (await super.create.call(this, data, driver)) as InstanceType<T>;
    }

    /** Enforce the same rules against the effective row for direct and RLS-constrained updates. */
    protected static async prepareUpdateMutation(
        data: Record<string, any>,
        context: UpdateMutationContext,
    ): Promise<Record<string, any>> {
        if (data.role !== undefined && !isOrganizationRosterRole(data.role)) {
            assertMembershipState({ role: data.role, status: 'active', userId: 'validation-only' });
        }
        if (data.status !== undefined && !isOrganizationRosterStatus(data.status)) {
            assertMembershipState({ role: 'member', status: data.status, userId: 'validation-only' });
        }

        let currentData = context.currentData;
        if (!currentData) {
            const current = await this.find(context.id, context.driver);
            if (!current) return data;
            currentData = {
                userId: current.get('userId'),
                invitedEmail: current.get('invitedEmail'),
                role: current.get('role'),
                status: current.get('status'),
            };
        }

        assertMembershipState({ ...currentData, ...data });
        return data;
    }

    /**
     * Add a user to an organization
     */
    static async addMember(data: NewOrganizationMemberType): Promise<OrganizationMemberType> {
        assertMembershipState(data);
        const db = this.getDriver().getDb();

        const [member] = await db
            .insert(organizationMembersTable)
            .values({
                ...data,
                invitedAt: data.invitedAt ?? Date.now(),
                // Stamp joinedAt only when the row starts active; invites get it on activation.
                joinedAt: (data.status ?? 'active') === 'active' ? (data.joinedAt ?? Date.now()) : data.joinedAt,
            })
            .returning();

        return member;
    }

    /**
     * Find an existing membership row for a user OR a pending email invite in an organization.
     * Use before adding to avoid duplicate invites/memberships.
     */
    static async findExistingInvite(params: {
        organizationId: string;
        userId?: string | null;
        invitedEmail?: string | null;
    }): Promise<OrganizationMemberType | undefined> {
        const db = this.getDriver().getDb();
        const identities = [];
        if (params.userId) identities.push(eq(organizationMembersTable.userId, params.userId));
        if (params.invitedEmail) identities.push(eq(organizationMembersTable.invitedEmail, params.invitedEmail));
        if (identities.length === 0) return undefined;

        const [member] = await db
            .select()
            .from(organizationMembersTable)
            .where(and(eq(organizationMembersTable.organizationId, params.organizationId), or(...identities)!))
            .limit(1);
        return member;
    }

    /**
     * Activate a user's pending email invites: when a user signs up / signs in, flip their
     * `invited` org rows (matched by email and not yet linked to a user) to `active`, link the
     * userId, and stamp `joinedAt`. Returns the number activated. Call from your auth flow — the
     * group-level equivalent lives on `UserGroupMember`.
     */
    static async activatePendingInvites(userId: string, email: string): Promise<number> {
        if (!userId || !email) return 0;
        const normalizedEmail = email.trim().toLowerCase();
        const db = this.getDriver().getDb();
        const now = Date.now();
        const rows = await db
            .update(organizationMembersTable)
            .set({
                status: 'active',
                userId,
                joinedAt: sql`COALESCE(${organizationMembersTable.joinedAt}, ${now})`,
                updatedAt: now,
            })
            .where(
                and(
                    // Case-insensitive: invited emails may be stored with mixed case.
                    sql`lower(${organizationMembersTable.invitedEmail}) = ${normalizedEmail}`,
                    eq(organizationMembersTable.status, 'invited'),
                    isNull(organizationMembersTable.userId),
                ),
            )
            .returning({ id: organizationMembersTable.id });
        return rows.length;
    }

    private static assertRosterMutationInput(
        userId: string,
        organizationId: string,
        expected: RosterMembershipExpected,
        changes?: RosterMembershipChanges,
    ): void {
        if (!userId || !organizationId) throw new TypeError('Roster mutation requires userId and organizationId');
        if (!isOrganizationRosterRole(expected.role) || !isOrganizationRosterStatus(expected.status)) {
            throw new TypeError('Roster mutation requires a valid expected role and status');
        }
        if (changes) {
            if (changes.role === undefined && changes.status === undefined) {
                throw new TypeError('Roster update requires role and/or status');
            }
            if (changes.role !== undefined && !isOrganizationRosterRole(changes.role)) {
                throw new TypeError('Roster update has an invalid role');
            }
            if (changes.status !== undefined && !isOrganizationRosterStatus(changes.status)) {
                throw new TypeError('Roster update has an invalid status');
            }
        }
    }

    /**
     * Build the optimistic roster predicate. When a mutation would move an active owner out of
     * that state, the predicate also requires another active owner in the same organization.
     * The target/peer aliases let the identical predicate live inside the user_roles DELETE.
     */
    private static rosterMutationPredicate(
        db: any,
        target: RosterPredicateColumns,
        otherOwner: RosterPredicateColumns,
        userId: string,
        organizationId: string,
        expected: RosterMembershipExpected,
        protectLastActiveOwner: boolean,
    ) {
        const conditions = [
            eq(target.userId, userId),
            eq(target.organizationId, organizationId),
            eq(target.role, expected.role),
            eq(target.status, expected.status),
        ];

        if (protectLastActiveOwner) {
            conditions.push(
                or(
                    ne(target.role, 'owner'),
                    ne(target.status, 'active'),
                    exists(
                        db
                            .select({ id: otherOwner.id })
                            .from(otherOwner)
                            .where(
                                and(
                                    eq(otherOwner.organizationId, organizationId),
                                    eq(otherOwner.role, 'owner'),
                                    eq(otherOwner.status, 'active'),
                                    ne(otherOwner.id, target.id),
                                ),
                            ),
                    ),
                )!,
            );
        }

        return and(...conditions)!;
    }

    private static rosterClassificationQuery(db: any, userId: string, organizationId: string) {
        const otherOwner = alias(organizationMembersTable, 'roster_classification_other_owner');
        return db
            .select({
                role: organizationMembersTable.role,
                status: organizationMembersTable.status,
                hasOtherActiveOwner: exists(
                    db
                        .select({ id: otherOwner.id })
                        .from(otherOwner)
                        .where(
                            and(
                                eq(otherOwner.organizationId, organizationId),
                                eq(otherOwner.role, 'owner'),
                                eq(otherOwner.status, 'active'),
                                ne(otherOwner.id, organizationMembersTable.id),
                            ),
                        ),
                ),
            })
            .from(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                ),
            )
            .limit(1);
    }

    private static classifyRosterMutationFailure(
        rows: Array<{ role: unknown; status: unknown; hasOtherActiveOwner: unknown }>,
        expected: RosterMembershipExpected,
        protectLastActiveOwner: boolean,
    ): 'not_found' | 'last_active_owner' | 'stale' {
        const current = rows[0];
        if (!current) return 'not_found';
        if (current.role !== expected.role || current.status !== expected.status) return 'stale';
        if (
            protectLastActiveOwner &&
            current.role === 'owner' &&
            current.status === 'active' &&
            !Boolean(current.hasOtherActiveOwner)
        ) {
            return 'last_active_owner';
        }
        return 'stale';
    }

    /**
     * Atomically update a roster membership. A role demotion revokes every org-scoped RBAC
     * grant in the same D1 batch; promotion and status-only suspension never mint/revoke grants.
     * Both statements carry the same expected role/status and last-active-owner predicate.
     */
    static async updateRosterMembership(
        userId: string,
        organizationId: string,
        changes: RosterMembershipChanges,
        expected: RosterMembershipExpected,
    ): Promise<UpdateRosterMembershipResult> {
        this.assertRosterMutationInput(userId, organizationId, expected, changes);
        const db = this.getDriver().getDb();
        if (typeof db.batch !== 'function') {
            throw new Error('Atomic roster updates require Drizzle D1 batch support');
        }

        const nextRole = changes.role ?? expected.role;
        const nextStatus = changes.status ?? expected.status;
        const protectLastActiveOwner =
            expected.role === 'owner' &&
            expected.status === 'active' &&
            (nextRole !== 'owner' || nextStatus !== 'active');
        const revokeGrants =
            changes.role !== undefined && ROSTER_ROLE_TIER[changes.role] < ROSTER_ROLE_TIER[expected.role];
        const now = Date.now();
        const values: Record<string, unknown> = { updatedAt: now };
        if (changes.role !== undefined) values.role = changes.role;
        if (changes.status !== undefined) {
            values.status = changes.status;
            if (changes.status === 'active') {
                values.joinedAt = sql`COALESCE(${organizationMembersTable.joinedAt}, ${now})`;
            }
        }

        const updateOtherOwner = alias(organizationMembersTable, 'roster_update_other_owner');
        const membershipUpdate = db
            .update(organizationMembersTable)
            .set(values)
            .where(
                this.rosterMutationPredicate(
                    db,
                    organizationMembersTable,
                    updateOtherOwner,
                    userId,
                    organizationId,
                    expected,
                    protectLastActiveOwner,
                ),
            )
            .returning();
        const classification = this.rosterClassificationQuery(db, userId, organizationId);

        let batchResults: unknown[];
        let membershipResultIndex: number;
        let classificationResultIndex: number;
        if (revokeGrants) {
            const guardedMember = alias(organizationMembersTable, 'roster_grant_member');
            const grantOtherOwner = alias(organizationMembersTable, 'roster_grant_other_owner');
            const grantDelete = db
                .delete(userRolesTable)
                .where(
                    and(
                        eq(userRolesTable.userId, userId),
                        eq(userRolesTable.organizationId, organizationId),
                        exists(
                            db
                                .select({ id: guardedMember.id })
                                .from(guardedMember)
                                .where(
                                    this.rosterMutationPredicate(
                                        db,
                                        guardedMember,
                                        grantOtherOwner,
                                        userId,
                                        organizationId,
                                        expected,
                                        protectLastActiveOwner,
                                    ),
                                ),
                        ),
                    ),
                )
                .returning({ roleId: userRolesTable.roleId });
            batchResults = (await db.batch([grantDelete, membershipUpdate, classification])) as unknown[];
            membershipResultIndex = 1;
            classificationResultIndex = 2;
        } else {
            batchResults = (await db.batch([membershipUpdate, classification])) as unknown[];
            membershipResultIndex = 0;
            classificationResultIndex = 1;
        }

        const updated = (batchResults[membershipResultIndex] as OrganizationMemberType[] | undefined)?.[0];
        if (updated) return { status: 'updated', member: updated };
        const failure = this.classifyRosterMutationFailure(
            (batchResults[classificationResultIndex] ?? []) as Array<{
                role: unknown;
                status: unknown;
                hasOtherActiveOwner: unknown;
            }>,
            expected,
            protectLastActiveOwner,
        );
        return { status: failure };
    }

    /**
     * Atomically remove a roster membership and all org-scoped RBAC grants. The grant DELETE and
     * membership DELETE share the optimistic and last-active-owner predicates, so neither can
     * succeed alone when the caller's snapshot is stale or the target is the final active owner.
     */
    static async removeRosterMembership(
        userId: string,
        organizationId: string,
        expected: RosterMembershipExpected,
    ): Promise<RemoveRosterMembershipResult> {
        this.assertRosterMutationInput(userId, organizationId, expected);
        const db = this.getDriver().getDb();
        if (typeof db.batch !== 'function') {
            throw new Error('Atomic roster removal requires Drizzle D1 batch support');
        }

        const membershipOtherOwner = alias(organizationMembersTable, 'roster_remove_other_owner');
        const membershipDelete = db
            .delete(organizationMembersTable)
            .where(
                this.rosterMutationPredicate(
                    db,
                    organizationMembersTable,
                    membershipOtherOwner,
                    userId,
                    organizationId,
                    expected,
                    true,
                ),
            )
            .returning({ id: organizationMembersTable.id });

        const guardedMember = alias(organizationMembersTable, 'roster_remove_grant_member');
        const grantOtherOwner = alias(organizationMembersTable, 'roster_remove_grant_other_owner');
        const grantDelete = db
            .delete(userRolesTable)
            .where(
                and(
                    eq(userRolesTable.userId, userId),
                    eq(userRolesTable.organizationId, organizationId),
                    exists(
                        db
                            .select({ id: guardedMember.id })
                            .from(guardedMember)
                            .where(
                                this.rosterMutationPredicate(
                                    db,
                                    guardedMember,
                                    grantOtherOwner,
                                    userId,
                                    organizationId,
                                    expected,
                                    true,
                                ),
                            ),
                    ),
                ),
            )
            .returning({ roleId: userRolesTable.roleId });
        const classification = this.rosterClassificationQuery(db, userId, organizationId);
        const batchResults = (await db.batch([grantDelete, membershipDelete, classification])) as unknown[];

        const removed = (batchResults[1] as Array<{ id: string }> | undefined)?.[0];
        if (removed) return { status: 'removed' };
        const failure = this.classifyRosterMutationFailure(
            (batchResults[2] ?? []) as Array<{
                role: unknown;
                status: unknown;
                hasOtherActiveOwner: unknown;
            }>,
            expected,
            true,
        );
        return { status: failure };
    }

    /** Cancel a userless pending invite by its stable membership id. */
    static async cancelPendingInvite(
        id: string,
        organizationId: string,
        expectedRole: OrganizationRosterRole,
    ): Promise<boolean> {
        if (!id || !organizationId || !isOrganizationRosterRole(expectedRole)) {
            throw new TypeError('Pending invite cancellation requires id, organizationId, and expected role');
        }
        const rows = await this.getDriver()
            .getDb()
            .delete(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.id, id),
                    eq(organizationMembersTable.organizationId, organizationId),
                    isNull(organizationMembersTable.userId),
                    eq(organizationMembersTable.status, 'invited'),
                    eq(organizationMembersTable.role, expectedRole),
                ),
            )
            .returning({ id: organizationMembersTable.id });
        return rows.length === 1;
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
                id: organizationMembersTable.id,
                userId: organizationMembersTable.userId,
                invitedEmail: organizationMembersTable.invitedEmail,
                organizationId: organizationMembersTable.organizationId,
                role: organizationMembersTable.role,
                status: organizationMembersTable.status,
                invitedBy: organizationMembersTable.invitedBy,
                invitedAt: organizationMembersTable.invitedAt,
                joinedAt: organizationMembersTable.joinedAt,
                metadata: organizationMembersTable.metadata,
                createdAt: organizationMembersTable.createdAt,
                updatedAt: organizationMembersTable.updatedAt,
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
                id: organizationMembersTable.id,
                userId: organizationMembersTable.userId,
                invitedEmail: organizationMembersTable.invitedEmail,
                organizationId: organizationMembersTable.organizationId,
                role: organizationMembersTable.role,
                status: organizationMembersTable.status,
                invitedBy: organizationMembersTable.invitedBy,
                invitedAt: organizationMembersTable.invitedAt,
                joinedAt: organizationMembersTable.joinedAt,
                metadata: organizationMembersTable.metadata,
                createdAt: organizationMembersTable.createdAt,
                updatedAt: organizationMembersTable.updatedAt,
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
     * All organization IDs a user can access, from ACTIVE MEMBERSHIPS only. This is the
     * authoritative "accessible orgs" set — use it to validate a user's active org and to populate
     * `SecurityContext.memberOrganizationIds` (the tenant-isolation boundary).
     *
     * Deliberately does NOT union `Organization.ownerId`: that field is stamped once at creation and
     * never cleared on removal/demotion (there is no ownership-transfer code), so unioning it would
     * let a user who was removed from an org they created retain access to it — a stale-ownership
     * cross-tenant leak. The org creator is always also given an ACTIVE owner membership row (see
     * user-provisioning / bootstrap), so active membership already covers every legitimate owner.
     */
    static async organizationIdsForUser(userId: string): Promise<string[]> {
        if (!userId) return [];
        const ids = new Set<string>();

        const memberships = await this.where({ userId, status: 'active' });
        for (const m of memberships) {
            const orgId = m.get('organizationId') as string | undefined;
            if (orgId) ids.add(orgId);
        }

        return Array.from(ids);
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
