// ============================================================
// @ottabase/ottaorm - OrganizationInvite model
// ============================================================

import { and, desc, eq, lt, ne } from 'drizzle-orm';
import { BaseModel, type ModelFields, type PackageType } from '../base/BaseModel';
import {
    organizationInvitesTable,
    type NewOrganizationInviteType,
    type OrganizationInviteType,
} from './OrganizationInvite.schema';

export {
    organizationInvitesTable,
    type NewOrganizationInviteType,
    type OrganizationInviteType,
} from './OrganizationInvite.schema';

export type OrgInviteStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';

export class OrganizationInvite extends BaseModel {
    static entity = 'organization_invites';
    static table = organizationInvitesTable;
    static primaryKey = 'id';
    static connection = 'default';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    static displayName = 'Organization Invite';
    static displayNamePlural = 'Organization Invites';
    static defaultSort = 'invitedAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        invitedAt: 'date' as const,
        expiresAt: 'date' as const,
        acceptedAt: 'date' as const,
        declinedAt: 'date' as const,
        revokedAt: 'date' as const,
        metadata: 'json' as const,
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        organizationId: { type: 'string', editable: false, uiConfig: { label: 'Organization' } },
        email: { type: 'string', editable: false, uiConfig: { label: 'Email' } },
        role: { type: 'string', editable: false, uiConfig: { label: 'Role' } },
        tokenHash: { type: 'string', editable: false, uiConfig: { label: 'Token hash' } },
        status: { type: 'string', editable: false, uiConfig: { label: 'Status' } },
        invitedBy: { type: 'string', editable: false, uiConfig: { label: 'Invited by' } },
        invitedAt: { type: 'date', editable: false, uiConfig: { label: 'Invited at' } },
        expiresAt: { type: 'date', editable: false, uiConfig: { label: 'Expires at' } },
        acceptedAt: { type: 'date', editable: false, uiConfig: { label: 'Accepted at' } },
        declinedAt: { type: 'date', editable: false, uiConfig: { label: 'Declined at' } },
        revokedAt: { type: 'date', editable: false, uiConfig: { label: 'Revoked at' } },
        metadata: { type: 'json', editable: false, uiConfig: { label: 'Metadata' } },
    };

    static async findByTokenHash(tokenHash: string): Promise<OrganizationInviteType | undefined> {
        const db = this.getDriver().getDb();
        const [row] = await db
            .select()
            .from(organizationInvitesTable)
            .where(eq(organizationInvitesTable.tokenHash, tokenHash))
            .limit(1);
        return row;
    }

    static async listForOrganization(
        organizationId: string,
        options?: { includeNonPending?: boolean },
    ): Promise<OrganizationInviteType[]> {
        const db = this.getDriver().getDb();
        const conditions = [eq(organizationInvitesTable.organizationId, organizationId)];
        if (!options?.includeNonPending) {
            conditions.push(eq(organizationInvitesTable.status, 'pending'));
        }
        return db
            .select()
            .from(organizationInvitesTable)
            .where(and(...conditions))
            .orderBy(desc(organizationInvitesTable.invitedAt));
    }

    static async revokePendingForEmail(organizationId: string, email: string): Promise<void> {
        const db = this.getDriver().getDb();
        const now = Date.now();
        await db
            .update(organizationInvitesTable)
            .set({ status: 'revoked', revokedAt: now })
            .where(
                and(
                    eq(organizationInvitesTable.organizationId, organizationId),
                    eq(organizationInvitesTable.email, email),
                    eq(organizationInvitesTable.status, 'pending'),
                ),
            );
    }

    /** Revoke other pending invites for the same email, keeping `exceptInviteId` (e.g. after a successful resend). */
    static async revokePendingForEmailExcept(
        organizationId: string,
        email: string,
        exceptInviteId: string,
    ): Promise<void> {
        const db = this.getDriver().getDb();
        const now = Date.now();
        await db
            .update(organizationInvitesTable)
            .set({ status: 'revoked', revokedAt: now })
            .where(
                and(
                    eq(organizationInvitesTable.organizationId, organizationId),
                    eq(organizationInvitesTable.email, email),
                    eq(organizationInvitesTable.status, 'pending'),
                    ne(organizationInvitesTable.id, exceptInviteId),
                ),
            );
    }

    static async deleteById(id: string): Promise<void> {
        const db = this.getDriver().getDb();
        await db.delete(organizationInvitesTable).where(eq(organizationInvitesTable.id, id));
    }

    static async insertInvite(row: NewOrganizationInviteType): Promise<OrganizationInviteType> {
        const db = this.getDriver().getDb();
        const [created] = await db.insert(organizationInvitesTable).values(row).returning();
        return created;
    }

    static async updateById(
        id: string,
        patch: Partial<OrganizationInviteType>,
    ): Promise<OrganizationInviteType | undefined> {
        const db = this.getDriver().getDb();
        const [updated] = await db
            .update(organizationInvitesTable)
            .set(patch)
            .where(eq(organizationInvitesTable.id, id))
            .returning();
        return updated;
    }

    /** Mark stale pending invites as expired (batch maintenance). */
    static async expirePendingPast(organizationId?: string): Promise<number> {
        const db = this.getDriver().getDb();
        const now = Date.now();
        const whereClause = organizationId
            ? and(
                  eq(organizationInvitesTable.organizationId, organizationId),
                  eq(organizationInvitesTable.status, 'pending'),
                  lt(organizationInvitesTable.expiresAt, now),
              )
            : and(eq(organizationInvitesTable.status, 'pending'), lt(organizationInvitesTable.expiresAt, now));

        const updated = await db
            .update(organizationInvitesTable)
            .set({ status: 'expired' })
            .where(whereClause)
            .returning({ id: organizationInvitesTable.id });

        return updated.length;
    }
}
