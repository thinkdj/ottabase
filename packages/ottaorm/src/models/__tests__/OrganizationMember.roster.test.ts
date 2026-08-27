import { drizzle } from 'drizzle-orm/d1';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearConnection, registerConnection } from '../../context';
import { OrganizationMember, type RosterMembershipExpected } from '../OrganizationMember';

interface CapturedStatement {
    sql: string;
    params: unknown[];
    bind(...params: unknown[]): CapturedStatement;
}

class FakeD1Statement implements CapturedStatement {
    params: unknown[] = [];

    constructor(readonly sql: string) {}

    bind(...params: unknown[]): this {
        this.params = params;
        return this;
    }
}

class FakeD1Database {
    readonly batches: CapturedStatement[][] = [];
    nextResults: Array<Array<Record<string, unknown>>> = [];

    prepare(sql: string): FakeD1Statement {
        return new FakeD1Statement(sql);
    }

    async batch(statements: CapturedStatement[]) {
        this.batches.push(statements);
        return this.nextResults.map((results) => ({
            success: true,
            results,
            meta: {},
        }));
    }
}

const EXPECTED_OWNER: RosterMembershipExpected = { role: 'owner', status: 'active' };

function memberRow(role: 'owner' | 'admin' | 'member', status: 'active' | 'invited' | 'suspended') {
    // D1's batch adapter maps object values positionally, so preserve table column order.
    return {
        id: 'membership-1',
        organization_id: 'org-1',
        user_id: 'user-1',
        invited_email: null,
        role,
        status,
        invited_by: null,
        invited_at: 10,
        joined_at: 20,
        metadata: null,
        created_at: 30,
        updated_at: 40,
    };
}

function classificationRow(
    role: 'owner' | 'admin' | 'member',
    status: 'active' | 'invited' | 'suspended',
    hasOtherActiveOwner: boolean,
) {
    return { role, status, has_other_active_owner: hasOtherActiveOwner ? 1 : 0 };
}

function normalizeSql(value: string): string {
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function expectOwnerGuard(statement: CapturedStatement, target: string): void {
    const query = normalizeSql(statement.sql);
    expect(query).toContain('exists');
    expect(query).toContain('other_owner');
    expect(query).toContain(`"${target}"."user_id" = ?`);
    expect(query).toContain(`"${target}"."organization_id" = ?`);
    expect(query).toContain(`"${target}"."role" = ?`);
    expect(query).toContain(`"${target}"."status" = ?`);
    expect(statement.params).toEqual(expect.arrayContaining(['user-1', 'org-1', 'owner', 'active']));
}

let database: FakeD1Database;

beforeEach(() => {
    clearConnection('default');
    database = new FakeD1Database();
    const db = drizzle(database as never);
    registerConnection('default', {
        getDb: () => db,
        execute: async () => [],
        executeRaw: async () => [],
    });
});

afterEach(() => {
    clearConnection('default');
});

describe('OrganizationMember atomic roster mutations', () => {
    it('guards both grant revocation and membership update during a demotion', async () => {
        database.nextResults = [
            [{ role_id: 'role-1' }],
            [memberRow('member', 'active')],
            [classificationRow('owner', 'active', true)],
        ];

        const result = await OrganizationMember.updateRosterMembership(
            'user-1',
            'org-1',
            { role: 'member' },
            EXPECTED_OWNER,
        );

        expect(result).toEqual({
            status: 'updated',
            member: expect.objectContaining({ id: 'membership-1', role: 'member', status: 'active' }),
        });
        expect(result.status === 'updated' && result.member).not.toBeInstanceOf(OrganizationMember);
        const [grantDelete, membershipUpdate] = database.batches[0];
        expect(normalizeSql(grantDelete.sql)).toContain('delete from "user_roles"');
        expect(normalizeSql(membershipUpdate.sql)).toContain('update "organization_members"');
        expectOwnerGuard(grantDelete, 'roster_grant_member');
        expectOwnerGuard(membershipUpdate, 'organization_members');
    });

    it('guards both grant revocation and membership deletion during removal', async () => {
        database.nextResults = [[{ role_id: 'role-1' }], [{ id: 'membership-1' }], []];

        await expect(OrganizationMember.removeRosterMembership('user-1', 'org-1', EXPECTED_OWNER)).resolves.toEqual({
            status: 'removed',
        });

        const [grantDelete, membershipDelete] = database.batches[0];
        expect(normalizeSql(grantDelete.sql)).toContain('delete from "user_roles"');
        expect(normalizeSql(membershipDelete.sql)).toContain('delete from "organization_members"');
        expectOwnerGuard(grantDelete, 'roster_remove_grant_member');
        expectOwnerGuard(membershipDelete, 'organization_members');
    });

    it('does not revoke grants for a status-only suspension', async () => {
        database.nextResults = [[memberRow('member', 'suspended')], [classificationRow('member', 'active', false)]];

        const result = await OrganizationMember.updateRosterMembership(
            'user-1',
            'org-1',
            { status: 'suspended' },
            { role: 'member', status: 'active' },
        );

        expect(result).toEqual({
            status: 'updated',
            member: expect.objectContaining({ role: 'member', status: 'suspended' }),
        });
        expect(database.batches[0]).toHaveLength(2);
        expect(database.batches[0].map((statement) => normalizeSql(statement.sql)).join(' ')).not.toContain(
            'delete from "user_roles"',
        );
    });

    it.each([
        { label: 'missing row', classification: [], status: 'not_found' as const },
        {
            label: 'changed snapshot',
            classification: [classificationRow('admin', 'active', true)],
            status: 'stale' as const,
        },
        {
            label: 'final active owner',
            classification: [classificationRow('owner', 'active', false)],
            status: 'last_active_owner' as const,
        },
    ])('classifies a failed demotion as $status ($label)', async ({ classification, status }) => {
        database.nextResults = [[], [], classification];

        await expect(
            OrganizationMember.updateRosterMembership('user-1', 'org-1', { role: 'member' }, EXPECTED_OWNER),
        ).resolves.toEqual({ status });
    });

    it.each([
        { label: 'missing row', classification: [], status: 'not_found' as const },
        {
            label: 'changed snapshot',
            classification: [classificationRow('owner', 'suspended', false)],
            status: 'stale' as const,
        },
        {
            label: 'final active owner',
            classification: [classificationRow('owner', 'active', false)],
            status: 'last_active_owner' as const,
        },
    ])('classifies a failed removal as $status ($label)', async ({ classification, status }) => {
        database.nextResults = [[], [], classification];

        await expect(OrganizationMember.removeRosterMembership('user-1', 'org-1', EXPECTED_OWNER)).resolves.toEqual({
            status,
        });
    });

    it('fails closed when the configured driver cannot provide a transactional D1 batch', async () => {
        registerConnection('default', { getDb: () => ({}) });

        await expect(OrganizationMember.removeRosterMembership('user-1', 'org-1', EXPECTED_OWNER)).rejects.toThrow(
            'Atomic roster removal requires Drizzle D1 batch support',
        );
    });
});
