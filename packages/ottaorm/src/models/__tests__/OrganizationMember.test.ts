import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { DomainValidationError } from '../../validation';
import { OrganizationMember } from '../OrganizationMember';
import { organizationMembersTable } from '../OrganizationMember.schema';

const indexNames = (table: unknown) =>
    Object.values(getTableConfig(table as any).indexes as any).map((i: any) => (i?.config ?? i)?.name);

describe('OrganizationMember unified membership shape', () => {
    it('uses a single `id` primary key (not the old composite key)', () => {
        expect(OrganizationMember.primaryKey).toBe('id');
        const pkCols = getTableConfig(organizationMembersTable)
            .columns.filter((c) => c.primary)
            .map((c) => c.name);
        expect(pkCols).toEqual(['id']);
    });

    it('enforces one membership per user and one invite per email, within an org', () => {
        const names = indexNames(organizationMembersTable);
        expect(names).toContain('organization_members_org_user_unique');
        expect(names).toContain('organization_members_org_email_unique');
    });

    it('supports email-first invites (nullable user_id + invited_email column)', () => {
        const cols = getTableConfig(organizationMembersTable).columns;
        expect(cols.find((c) => c.name === 'user_id')?.notNull).toBe(false); // null until the invite is accepted
        expect(cols.find((c) => c.name === 'invited_email')).toBeDefined();
        // joinedAt is now stamped on activation, so it is nullable for pending invites.
        expect(cols.find((c) => c.name === 'joined_at')?.notNull).toBe(false);
    });

    it('backs role, status, and invite identity invariants with SQLite checks', () => {
        const dialect = new SQLiteSyncDialect();
        const checks = Object.fromEntries(
            getTableConfig(organizationMembersTable).checks.map((constraint) => [
                constraint.name,
                dialect.sqlToQuery(constraint.value).sql.replace(/\s+/g, ' ').toLowerCase(),
            ]),
        );

        expect(checks.organization_members_role_check).toContain("in ('owner', 'admin', 'member')");
        expect(checks.organization_members_status_check).toContain("in ('active', 'invited', 'suspended')");
        expect(checks.organization_members_pending_invite_status_check).toMatch(
            /"user_id" is null and .*"status" = 'invited'/,
        );
    });

    it('rejects phantom active memberships before create persistence', async () => {
        const error = await OrganizationMember.create({
            organizationId: 'org-1',
            role: 'member',
            status: 'active',
        }).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(DomainValidationError);
        expect(error).toMatchObject({
            code: 'INVALID_ORGANIZATION_MEMBERSHIP',
            status: 422,
            fieldErrors: {
                invitedEmail: ['An invited email is required when no user is linked'],
                status: ['A membership without a user must remain invited'],
            },
        });
    });

    it('validates the effective row before an update is persisted', async () => {
        const currentData = {
            id: 'membership-1',
            organizationId: 'org-1',
            userId: 'user-1',
            invitedEmail: null,
            role: 'member',
            status: 'active',
        };

        await expect(
            OrganizationMember.update('membership-1', { userId: null }, undefined, currentData),
        ).rejects.toMatchObject({
            code: 'INVALID_ORGANIZATION_MEMBERSHIP',
            status: 422,
            fieldErrors: {
                invitedEmail: ['An invited email is required when no user is linked'],
                status: ['A membership without a user must remain invited'],
            },
        });
    });

    it('rejects invalid role/status values through the fat model hook', async () => {
        const currentData = {
            userId: 'user-1',
            invitedEmail: null,
            role: 'member',
            status: 'active',
        };

        await expect(
            OrganizationMember.update('membership-1', { status: 'unknown' }, undefined, currentData),
        ).rejects.toMatchObject({
            code: 'INVALID_ORGANIZATION_MEMBERSHIP',
            fieldErrors: { status: ['Status must be active, invited, or suspended'] },
        });
    });
});
