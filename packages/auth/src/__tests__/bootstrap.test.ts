import { describe, expect, it } from 'vitest';
import { bootstrapFirstUser, provisionPlatformOwnerOrganization, SYSTEM_ORGANIZATION_ID } from '../bootstrap';
import type { AuthEnv } from '../types';

type RoleRow = { id: string; name: string };
type GrantRow = { userId: string; roleId: string; organizationId: string };
type OrganizationRow = { id: string; name: string; slug: string; ownerId: string };
type MembershipRow = {
    id: string;
    userId: string;
    organizationId: string;
    role: string;
    status: string;
};

interface FakeD1State {
    roles: RoleRow[];
    grants: GrantRow[];
    organizations: OrganizationRow[];
    memberships: MembershipRow[];
    users: Array<{ id: string; name: string | null; email: string }>;
    failNextBatch: boolean;
    commitBeforeBatchFailure: boolean;
    batchCalls: number;
    claimCalls: number;
}

class FakeStatement {
    private args: unknown[] = [];

    constructor(
        readonly sql: string,
        private readonly state: FakeD1State,
    ) {}

    bind(...args: unknown[]): FakeStatement {
        this.args = args;
        return this;
    }

    async first<T>(): Promise<T | null> {
        const sql = normalizeSql(this.sql);

        if (sql.includes('select id from roles where name')) {
            const role = this.state.roles.find((item) => item.name === this.args[0]);
            return (role ? { id: role.id } : null) as T | null;
        }

        if (sql.includes('from organization_members') && sql.includes("status = 'active'")) {
            const ownerOnly = sql.includes("role = 'owner'");
            const membership = this.state.memberships.find(
                (item) =>
                    item.userId === this.args[0] && item.status === 'active' && (!ownerOnly || item.role === 'owner'),
            );
            return (
                membership ? { organizationId: membership.organizationId, role: membership.role } : null
            ) as T | null;
        }

        if (sql.includes('select name, email from users')) {
            const user = this.state.users.find((item) => item.id === this.args[0]);
            return (user ? { name: user.name, email: user.email } : null) as T | null;
        }

        if (sql.includes('select 1 from organizations where slug')) {
            return (this.state.organizations.some((item) => item.slug === this.args[0]) ? { 1: 1 } : null) as T | null;
        }

        if (sql.includes('select 1 as hasgrant') && sql.includes('from user_roles')) {
            const grant = this.state.grants.find(
                (item) =>
                    item.userId === this.args[0] &&
                    item.roleId === this.args[1] &&
                    item.organizationId === this.args[2],
            );
            return (grant ? { hasGrant: 1 } : null) as T | null;
        }

        if (sql.includes('select user_id as userid') && sql.includes('from user_roles')) {
            const roleId = String(this.args[0]);
            const organizationId = String(this.args[1]);
            const currentUserId = String(this.args[2]);
            const candidates = this.state.grants.filter(
                (item) => item.roleId === roleId && item.organizationId === organizationId,
            );
            const grant = candidates.find((item) => item.userId === currentUserId) ?? candidates[0];
            return (grant ? { userId: grant.userId } : null) as T | null;
        }

        throw new Error(`Unhandled fake D1 first(): ${sql}`);
    }

    async run(): Promise<{ meta: { changes: number } }> {
        return this.executeRun();
    }

    executeRun(): { meta: { changes: number } } {
        const sql = normalizeSql(this.sql);

        if (sql.startsWith('insert or ignore into roles')) {
            const [id, name] = this.args.map(String);
            if (this.state.roles.some((item) => item.name === name)) {
                return { meta: { changes: 0 } };
            }
            this.state.roles.push({ id, name });
            return { meta: { changes: 1 } };
        }

        if (sql.startsWith('insert into user_roles') && sql.includes('where not exists')) {
            this.state.claimCalls += 1;
            const [userId, roleId, organizationId] = this.args.map(String);
            if (this.state.grants.some((item) => item.roleId === roleId && item.organizationId === organizationId)) {
                return { meta: { changes: 0 } };
            }
            this.state.grants.push({ userId, roleId, organizationId });
            return { meta: { changes: 1 } };
        }

        if (sql.startsWith('insert or ignore into user_roles')) {
            const [userId, roleId, organizationId] = this.args.map(String);
            if (
                !this.state.grants.some(
                    (item) =>
                        item.userId === userId && item.roleId === roleId && item.organizationId === organizationId,
                )
            ) {
                this.state.grants.push({ userId, roleId, organizationId });
                return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
        }

        if (sql.startsWith('insert into organizations')) {
            const [id, name, slug, ownerId] = this.args.map(String);
            if (this.state.organizations.some((item) => item.slug === slug)) {
                throw new Error('D1_ERROR: UNIQUE constraint failed: organizations.slug');
            }
            if (this.state.organizations.some((item) => item.id === id)) {
                throw new Error('D1_ERROR: UNIQUE constraint failed: organizations.id');
            }
            this.state.organizations.push({ id, name, slug, ownerId });
            return { meta: { changes: 1 } };
        }

        if (sql.startsWith('insert into organization_members')) {
            const [id, userId, organizationId] = this.args.map(String);
            this.state.memberships.push({
                id,
                userId,
                organizationId,
                role: 'owner',
                status: 'active',
            });
            return { meta: { changes: 1 } };
        }

        if (sql.startsWith('insert into user_roles')) {
            const [userId, roleId, organizationId] = this.args.map(String);
            this.state.grants.push({ userId, roleId, organizationId });
            return { meta: { changes: 1 } };
        }

        if (sql.startsWith('delete from user_roles')) {
            const [userId, roleId, organizationId] = this.args.map(String);
            const before = this.state.grants.length;
            this.state.grants = this.state.grants.filter(
                (item) => !(item.userId === userId && item.roleId === roleId && item.organizationId === organizationId),
            );
            return { meta: { changes: before - this.state.grants.length } };
        }

        throw new Error(`Unhandled fake D1 run(): ${sql}`);
    }
}

function normalizeSql(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function createFakeD1(initial: Partial<FakeD1State> = {}) {
    const state: FakeD1State = {
        roles: [],
        grants: [],
        organizations: [],
        memberships: [],
        users: [{ id: 'user-1', name: 'Founder', email: 'founder@example.com' }],
        failNextBatch: false,
        commitBeforeBatchFailure: false,
        batchCalls: 0,
        claimCalls: 0,
        ...initial,
    };

    const database = {
        prepare(sql: string) {
            return new FakeStatement(sql, state);
        },
        async batch(statements: FakeStatement[]) {
            state.batchCalls += 1;
            if (state.failNextBatch) {
                state.failNextBatch = false;
                if (state.commitBeforeBatchFailure) {
                    statements.forEach((statement) => statement.executeRun());
                }
                throw new Error('simulated transactional batch failure');
            }
            return statements.map((statement) => statement.executeRun());
        },
    };

    return { database: database as unknown as NonNullable<AuthEnv['OBCF_D1']>, state };
}

function createEnv(database: NonNullable<AuthEnv['OBCF_D1']>, overrides: Partial<AuthEnv> = {}): AuthEnv {
    return {
        AUTH_SECRET: 'test-secret-at-least-32-chars-long!!',
        OBCF_D1: database,
        ...overrides,
    } as AuthEnv;
}

describe('bootstrapFirstUser', () => {
    it('atomically provisions the winning platform owner with an active organization and scoped owner grant', async () => {
        const { database, state } = createFakeD1();

        const result = await bootstrapFirstUser(createEnv(database), {
            id: 'user-1',
            email: 'founder@example.com',
            name: 'Founder',
        });

        expect(result.isPlatformOwner).toBe(true);
        expect(result.organizationId).toMatch(/^org-/);
        expect(state.batchCalls).toBe(1);
        expect(state.memberships).toContainEqual(
            expect.objectContaining({
                userId: 'user-1',
                organizationId: result.organizationId,
                role: 'owner',
                status: 'active',
            }),
        );

        const platformRole = state.roles.find((role) => role.name === 'platform_owner');
        const ownerRole = state.roles.find((role) => role.name === 'owner');
        expect(platformRole).toBeDefined();
        expect(ownerRole).toBeDefined();
        expect(state.grants).toEqual(
            expect.arrayContaining([
                {
                    userId: 'user-1',
                    roleId: platformRole!.id,
                    organizationId: SYSTEM_ORGANIZATION_ID,
                },
                {
                    userId: 'user-1',
                    roleId: ownerRole!.id,
                    organizationId: result.organizationId!,
                },
            ]),
        );
    });

    it('surfaces tenant provisioning failure, retains the original platform claim, and permits same-owner healing', async () => {
        const { database, state } = createFakeD1({
            roles: [{ id: 'owner-role', name: 'owner' }],
            failNextBatch: true,
        });
        const env = createEnv(database);
        const user = { id: 'user-1', email: 'founder@example.com', name: 'Founder' };

        await expect(bootstrapFirstUser(env, user)).rejects.toThrow('simulated transactional batch failure');
        const platformRole = state.roles.find((role) => role.name === 'platform_owner')!;
        expect(state.grants).toContainEqual({
            userId: 'user-1',
            roleId: platformRole.id,
            organizationId: SYSTEM_ORGANIZATION_ID,
        });
        expect(state.organizations).toHaveLength(0);
        expect(state.memberships).toHaveLength(0);

        await expect(bootstrapFirstUser(env, user)).resolves.toMatchObject({
            isPlatformOwner: true,
            organizationId: expect.stringMatching(/^org-/),
        });
    });

    it('treats a concurrently committed owner workspace as an idempotent success', async () => {
        const { database, state } = createFakeD1({
            roles: [{ id: 'owner-role', name: 'owner' }],
            failNextBatch: true,
            commitBeforeBatchFailure: true,
        });

        const result = await bootstrapFirstUser(createEnv(database), {
            id: 'user-1',
            email: 'founder@example.com',
            name: 'Founder',
        });

        expect(result).toEqual({
            isPlatformOwner: true,
            organizationId: 'org-user-1',
        });
        expect(state.organizations).toHaveLength(1);
        expect(state.memberships).toHaveLength(1);
    });

    it('heals a missing organization when the same user already owns the platform claim', async () => {
        const { database, state } = createFakeD1({
            roles: [
                { id: 'platform-role', name: 'platform_owner' },
                { id: 'owner-role', name: 'owner' },
            ],
            grants: [
                {
                    userId: 'user-1',
                    roleId: 'platform-role',
                    organizationId: SYSTEM_ORGANIZATION_ID,
                },
            ],
        });

        const result = await bootstrapFirstUser(createEnv(database), {
            id: 'user-1',
            email: 'founder@example.com',
        });

        expect(result).toMatchObject({
            isPlatformOwner: true,
            organizationId: expect.stringMatching(/^org-/),
        });
        expect(state.batchCalls).toBe(1);
    });

    it('reuses a manual active owner membership and repairs its missing scoped owner grant', async () => {
        const { database, state } = createFakeD1({
            roles: [
                { id: 'platform-role', name: 'platform_owner' },
                { id: 'owner-role', name: 'owner' },
            ],
            grants: [
                {
                    userId: 'user-1',
                    roleId: 'platform-role',
                    organizationId: SYSTEM_ORGANIZATION_ID,
                },
            ],
            organizations: [
                {
                    id: 'org-manual',
                    name: 'Manual Workspace',
                    slug: 'manual-workspace',
                    ownerId: 'user-1',
                },
            ],
            memberships: [
                {
                    id: 'membership-manual',
                    userId: 'user-1',
                    organizationId: 'org-manual',
                    role: 'owner',
                    status: 'active',
                },
            ],
        });

        await expect(bootstrapFirstUser(createEnv(database), { id: 'user-1' })).resolves.toEqual({
            isPlatformOwner: true,
            organizationId: 'org-manual',
        });
        expect(state.batchCalls).toBe(0);
        expect(state.grants).toContainEqual({
            userId: 'user-1',
            roleId: 'owner-role',
            organizationId: 'org-manual',
        });
    });

    it('intentionally skips personal organization provisioning when multi-tenant mode is disabled', async () => {
        const { database, state } = createFakeD1({
            roles: [{ id: 'owner-role', name: 'owner' }],
        });

        await expect(
            bootstrapFirstUser(createEnv(database, { MULTI_TENANT_ENABLED: 'false' }), { id: 'user-1' }),
        ).resolves.toEqual({
            isPlatformOwner: true,
            organizationId: null,
        });
        expect(state.batchCalls).toBe(0);
        expect(state.organizations).toHaveLength(0);
    });

    it('does not provision a tenant for a later user when another platform owner won the claim', async () => {
        const { database, state } = createFakeD1({
            roles: [
                { id: 'platform-role', name: 'platform_owner' },
                { id: 'owner-role', name: 'owner' },
            ],
            grants: [
                {
                    userId: 'another-user',
                    roleId: 'platform-role',
                    organizationId: SYSTEM_ORGANIZATION_ID,
                },
            ],
        });

        await expect(bootstrapFirstUser(createEnv(database), { id: 'user-1' })).resolves.toEqual({
            isPlatformOwner: false,
            organizationId: null,
        });
        expect(state.batchCalls).toBe(0);
        expect(state.organizations).toHaveLength(0);
        expect(state.claimCalls).toBe(0);
    });

    it('retries a transactional slug collision when different same-named owners provision concurrently', async () => {
        const { database, state } = createFakeD1({
            users: [
                { id: 'user-1', name: 'Founder', email: 'founder-1@example.com' },
                { id: 'user-2', name: 'Founder', email: 'founder-2@example.com' },
            ],
        });
        const env = createEnv(database);

        const organizationIds = await Promise.all([
            provisionPlatformOwnerOrganization(env, {
                id: 'user-1',
                email: 'founder-1@example.com',
                name: 'Founder',
            }),
            provisionPlatformOwnerOrganization(env, {
                id: 'user-2',
                email: 'founder-2@example.com',
                name: 'Founder',
            }),
        ]);

        expect(new Set(organizationIds).size).toBe(2);
        expect(new Set(state.organizations.map((organization) => organization.slug)).size).toBe(2);
        expect(state.organizations).toHaveLength(2);
        expect(state.memberships).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ userId: 'user-1', role: 'owner', status: 'active' }),
                expect.objectContaining({ userId: 'user-2', role: 'owner', status: 'active' }),
            ]),
        );
    });
});
