// ============================================================
// @ottabase/auth - First-User Bootstrap
// ============================================================
//
// When the very first user account is created (credentials registration,
// OAuth sign-in, or magic link), grant it the system-scoped "platform_owner"
// role (the app owner, distinct from the org-scoped "owner" role) and --
// unless multi-tenant mode is disabled -- provision a personal organization.
//
// ============================================================

// Role names and their permission sets come from @ottabase/ottaorm/models, the
// single source of truth for the RBAC schema this package writes into. Both are
// first-party framework packages, so importing the canonical definitions is
// preferred over re-declaring them here and letting the two drift apart.
import { PLATFORM_OWNER_ROLE_NAME as CANONICAL_PLATFORM_OWNER_ROLE_NAME, Role } from '@ottabase/ottaorm/models';
import { makeSlug } from '@ottabase/utils/url';
import type { AuthEnv } from './types';

export const SYSTEM_ORGANIZATION_ID = 'system';
export { PLATFORM_OWNER_ROLE_NAME } from '@ottabase/ottaorm/models';
const ORGANIZATION_OWNER_ROLE_NAME = 'owner';
const MAX_ORGANIZATION_WRITE_ATTEMPTS = 3;

export interface FirstUserBootstrapResult {
    /** True when this user owns the system-scoped platform-owner grant. */
    isPlatformOwner: boolean;
    /** The active organization selected or created for this owner in multi-tenant mode. */
    organizationId: string | null;
}

export function parseBooleanFlag(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
}

function isOrganizationSlugConflict(error: unknown): boolean {
    const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
    const message =
        error instanceof Error ? `${error.message} ${cause === undefined ? '' : String(cause)}` : String(error);
    return /unique constraint failed:\s*organizations\.slug/i.test(message);
}

async function ensureBootstrapRole(env: AuthEnv, roleName: string): Promise<string> {
    if (!env.OBCF_D1) {
        throw new Error('OBCF_D1 is required to initialize bootstrap roles');
    }

    const definition = Role.DEFAULT_ROLE_DEFINITIONS.find((role) => role.name === roleName);
    if (!definition) {
        throw new Error(`Missing canonical bootstrap role definition: ${roleName}`);
    }

    // Role initialization runs on every sign-in path, so keep the steady state
    // read-only. D1 writes serialize; avoiding a no-op INSERT reduces contention.
    const existing = await env.OBCF_D1.prepare(`SELECT id FROM roles WHERE name = ? LIMIT 1`)
        .bind(roleName)
        .first<{ id?: string }>();
    if (existing?.id) {
        return String(existing.id);
    }

    // `name` is UNIQUE, so this insert is a safe, atomic "create if missing":
    // concurrent callers can never both create the row regardless of interleaving.
    const roleId = crypto.randomUUID();
    const now = Date.now();

    await env.OBCF_D1.prepare(
        `INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
        .bind(roleId, definition.name, definition.description, JSON.stringify(definition.permissions), 1, now, now)
        .run();

    // Whether this call created the row or lost the race, re-read the canonical id.
    const initialized = await env.OBCF_D1.prepare(`SELECT id FROM roles WHERE name = ? LIMIT 1`)
        .bind(roleName)
        .first<{ id?: string }>();

    if (!initialized?.id) {
        throw new Error(`Failed to initialize bootstrap role: ${roleName}`);
    }

    return String(initialized.id);
}

export async function ensurePlatformOwnerRole(env: AuthEnv): Promise<string> {
    return ensureBootstrapRole(env, CANONICAL_PLATFORM_OWNER_ROLE_NAME);
}

export async function createPersonalOrganizationIfMissing(
    env: AuthEnv,
    userId: string,
    userEmail?: string | null,
    userName?: string | null,
): Promise<string> {
    if (!env.OBCF_D1) {
        throw new Error('OBCF_D1 is required to provision an organization');
    }
    if (!userId) {
        throw new Error('A user id is required to provision an organization');
    }

    const existingMembership = await env.OBCF_D1.prepare(
        `SELECT organization_id as organizationId, role
         FROM organization_members
         WHERE user_id = ? AND status = 'active' AND role = 'owner'
         ORDER BY created_at ASC
         LIMIT 1`,
    )
        .bind(userId)
        .first<{ organizationId?: string; role?: string }>();

    if (existingMembership?.organizationId) {
        // Repair the RBAC half of an existing owner membership if an earlier attempt
        // committed the membership but stopped before its org-scoped role grant.
        if (existingMembership.role === ORGANIZATION_OWNER_ROLE_NAME) {
            const ownerRoleId = await ensureBootstrapRole(env, ORGANIZATION_OWNER_ROLE_NAME);

            await env.OBCF_D1.prepare(
                `INSERT OR IGNORE INTO user_roles
                    (user_id, role_id, organization_id, assigned_at, assigned_by)
                 VALUES (?, ?, ?, ?, ?)`,
            )
                .bind(userId, ownerRoleId, String(existingMembership.organizationId), Date.now(), 'system')
                .run();
        }

        return String(existingMembership.organizationId);
    }

    const profile = await env.OBCF_D1.prepare(`SELECT name, email FROM users WHERE id = ? LIMIT 1`)
        .bind(userId)
        .first<{ name?: string | null; email?: string | null }>();

    const baseName = (userName || profile?.name || profile?.email || userEmail || 'Founder').toString().trim();
    const workspaceName = `${baseName || 'Founder'}'s Workspace`;
    const slugBase = makeSlug(workspaceName) || `org-${userId.slice(0, 8)}`;

    let slug = slugBase;
    for (let attempt = 1; attempt <= 5; attempt++) {
        const slugExists = await env.OBCF_D1.prepare(`SELECT 1 FROM organizations WHERE slug = ? LIMIT 1`)
            .bind(slug)
            .first();
        if (!slugExists) break;
        slug = attempt === 5 ? `${slugBase}-${crypto.randomUUID().slice(0, 6)}` : `${slugBase}-${attempt}`;
    }

    const ownerRoleId = await ensureBootstrapRole(env, ORGANIZATION_OWNER_ROLE_NAME);

    // A deterministic id makes retries and concurrent callbacks idempotent for this
    // user's personal workspace without globally forbidding one owner from creating
    // additional, non-personal organizations elsewhere in the product.
    const organizationId = `org-${userId}`;
    const now = Date.now();

    // D1 batch calls are transactions. Keeping the tenant row, its active owner
    // membership, and the matching org-scoped RBAC grant in one batch prevents
    // any of the three security facts from becoming visible on its own.
    for (let writeAttempt = 1; writeAttempt <= MAX_ORGANIZATION_WRITE_ATTEMPTS; writeAttempt++) {
        try {
            await env.OBCF_D1.batch([
                env.OBCF_D1.prepare(
                    `INSERT INTO organizations (id, name, slug, owner_id, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, 'active', ?, ?)`,
                ).bind(organizationId, workspaceName, slug, userId, now, now),
                env.OBCF_D1.prepare(
                    `INSERT INTO organization_members
                        (id, user_id, organization_id, role, status, joined_at, created_at, updated_at)
                     VALUES (?, ?, ?, 'owner', 'active', ?, ?, ?)`,
                ).bind(crypto.randomUUID(), userId, organizationId, now, now, now),
                env.OBCF_D1.prepare(
                    `INSERT INTO user_roles
                        (user_id, role_id, organization_id, assigned_at, assigned_by)
                     VALUES (?, ?, ?, ?, ?)`,
                ).bind(userId, ownerRoleId, organizationId, now, 'system'),
            ]);
            return organizationId;
        } catch (error) {
            // Another callback for the same owner may have committed this deterministic
            // workspace while this request was preparing its batch. Treat that as an
            // idempotent success only after re-reading the complete owner membership.
            const concurrentlyCreated = await env.OBCF_D1.prepare(
                `SELECT organization_id as organizationId
                 FROM organization_members
                 WHERE user_id = ? AND status = 'active' AND role = 'owner'
                 ORDER BY created_at ASC
                 LIMIT 1`,
            )
                .bind(userId)
                .first<{ organizationId?: string }>();

            if (concurrentlyCreated?.organizationId) {
                await env.OBCF_D1.prepare(
                    `INSERT OR IGNORE INTO user_roles
                        (user_id, role_id, organization_id, assigned_at, assigned_by)
                     VALUES (?, ?, ?, ?, ?)`,
                )
                    .bind(userId, ownerRoleId, String(concurrentlyCreated.organizationId), Date.now(), 'system')
                    .run();

                return String(concurrentlyCreated.organizationId);
            }

            // Slugs are globally unique. A different same-named user can win the
            // SELECT/INSERT race after our availability read, so retry only that
            // exact constraint with a fresh suffix. Other failures remain fail-closed.
            if (writeAttempt < MAX_ORGANIZATION_WRITE_ATTEMPTS && isOrganizationSlugConflict(error)) {
                slug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;
                continue;
            }

            throw error;
        }
    }

    throw new Error('Organization provisioning exhausted all write attempts');
}

/**
 * Enforce the tenant half of platform-owner provisioning without changing the
 * system role grant. This is shared by automatic first-user bootstrap and
 * explicit promotion flows.
 */
export async function provisionPlatformOwnerOrganization(
    env: AuthEnv,
    user: { id?: string; email?: string | null; name?: string | null },
): Promise<string | null> {
    if (!user?.id) {
        throw new Error('A user id is required to provision a platform-owner organization');
    }

    const multiTenantFlag = env.MULTI_TENANT_ENABLED;
    const multiTenantEnabled = multiTenantFlag === undefined ? true : parseBooleanFlag(multiTenantFlag);
    if (!multiTenantEnabled) {
        return null;
    }

    return createPersonalOrganizationIfMissing(env, user.id, user.email ?? null, user.name ?? null);
}

export async function bootstrapFirstUser(
    env: AuthEnv,
    user: { id?: string; email?: string | null; name?: string | null },
): Promise<FirstUserBootstrapResult> {
    if (!env.OBCF_D1) {
        throw new Error('OBCF_D1 is required to bootstrap the first user');
    }
    if (!user?.id) {
        throw new Error('A user id is required to bootstrap the first user');
    }

    const platformOwnerRoleId = await ensurePlatformOwnerRole(env);
    const existingOwner = await env.OBCF_D1.prepare(
        `SELECT user_id as userId
         FROM user_roles
         WHERE role_id = ? AND organization_id = ?
         ORDER BY CASE WHEN user_id = ? THEN 0 ELSE 1 END
         LIMIT 1`,
    )
        .bind(platformOwnerRoleId, SYSTEM_ORGANIZATION_ID, user.id)
        .first<{ userId?: string }>();

    if (existingOwner?.userId) {
        if (String(existingOwner.userId) !== user.id) {
            return { isPlatformOwner: false, organizationId: null };
        }

        const organizationId = await provisionPlatformOwnerOrganization(env, user);
        return { isPlatformOwner: true, organizationId };
    }

    // Atomically claim the "first user" slot. The INSERT and its NOT EXISTS
    // predicate are one statement, so concurrent sign-ins cannot both win. The
    // common post-bootstrap sign-in path returns above without taking a D1 write.
    const now = Date.now();
    const claim = await env.OBCF_D1.prepare(
        `INSERT INTO user_roles (user_id, role_id, organization_id, assigned_at)
         SELECT ?, ?, ?, ?
         WHERE NOT EXISTS (
             SELECT 1 FROM user_roles WHERE role_id = ? AND organization_id = ?
         )`,
    )
        .bind(user.id, platformOwnerRoleId, SYSTEM_ORGANIZATION_ID, now, platformOwnerRoleId, SYSTEM_ORGANIZATION_ID)
        .run();

    const wonPlatformOwnerClaim = (claim?.meta?.changes ?? 0) > 0;
    let isPlatformOwner = wonPlatformOwnerClaim;

    if (!wonPlatformOwnerClaim) {
        // A request can die after committing the claim but before provisioning the
        // organization. Recognize that same claimant on the next sign-in and heal
        // the missing organization instead of permanently skipping bootstrap.
        const currentOwnerGrant = await env.OBCF_D1.prepare(
            `SELECT 1 as hasGrant
             FROM user_roles
             WHERE user_id = ? AND role_id = ? AND organization_id = ?
             LIMIT 1`,
        )
            .bind(user.id, platformOwnerRoleId, SYSTEM_ORGANIZATION_ID)
            .first<{ hasGrant?: number }>();
        isPlatformOwner = currentOwnerGrant?.hasGrant === 1;
    }

    if (!isPlatformOwner) {
        return { isPlatformOwner: false, organizationId: null };
    }

    const organizationId = await provisionPlatformOwnerOrganization(env, user);
    return { isPlatformOwner: true, organizationId };
}
