// ============================================================
// @ottabase/auth - First-User Bootstrap
// ============================================================
//
// When the very first user account is created (credentials registration,
// OAuth sign-in, or magic link), grant it the system "owner" role and --
// unless multi-tenant mode is disabled -- provision a personal organization.
//
// ============================================================

import { makeSlug } from '@ottabase/utils/url';
import type { AuthEnv } from './types';

export const SYSTEM_ORGANIZATION_ID = 'system';
export const OWNER_ROLE_NAME = 'owner';

export function parseBooleanFlag(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
}

export async function ensureOwnerRole(env: AuthEnv): Promise<string | null> {
    if (!env.OBCF_D1) return null;

    try {
        // `name` is UNIQUE, so this insert is a safe, atomic "create if missing":
        // concurrent callers can never both succeed in creating the row, regardless
        // of interleaving, because SQLite (D1) serializes writes to a single database.
        const roleId = crypto.randomUUID();
        const now = Date.now();

        await env.OBCF_D1.prepare(
            `INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
            .bind(roleId, OWNER_ROLE_NAME, 'System owner with full privileges', JSON.stringify(['*:*']), 1, now, now)
            .run();

        // Whether this call created the row or lost the race to another concurrent
        // call, re-read to get the canonical (possibly pre-existing) id.
        const existing = await env.OBCF_D1.prepare(`SELECT id FROM roles WHERE name = ? LIMIT 1`)
            .bind(OWNER_ROLE_NAME)
            .first<any>();

        return existing?.id ? String(existing.id) : null;
    } catch (error) {
        console.warn('ensureOwnerRole failed:', error);
        return null;
    }
}

export async function createPersonalOrganizationIfMissing(
    env: AuthEnv,
    userId: string,
    userEmail?: string | null,
    userName?: string | null,
): Promise<string | null> {
    if (!env.OBCF_D1) return null;

    try {
        const existingMembership = await env.OBCF_D1.prepare(
            `SELECT organization_id as organizationId FROM organization_members WHERE user_id = ? LIMIT 1`,
        )
            .bind(userId)
            .first<any>();

        if (existingMembership?.organizationId) {
            return String(existingMembership.organizationId);
        }

        const profile = await env.OBCF_D1.prepare(`SELECT name, email FROM users WHERE id = ? LIMIT 1`)
            .bind(userId)
            .first<any>();

        const baseName = (userName || profile?.name || profile?.email || userEmail || 'Founder').toString().trim();
        const workspaceName = `${baseName || 'Founder'}'s Workspace`;
        const slugBase = makeSlug(workspaceName) || `org-${userId.slice(0, 8)}`;

        let slug = slugBase;
        for (let attempt = 1; attempt <= 5; attempt++) {
            const slugExists = await env.OBCF_D1.prepare(`SELECT 1 FROM organizations WHERE slug = ? LIMIT 1`)
                .bind(slug)
                .first<any>();
            if (!slugExists) break;
            slug = `${slugBase}-${attempt}`;
        }

        const organizationId = `org-${crypto.randomUUID()}`;
        const now = Date.now();

        await env.OBCF_D1.prepare(
            `INSERT INTO organizations (id, name, slug, owner_id, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'active', ?, ?)`,
        )
            .bind(organizationId, workspaceName, slug, userId, now, now)
            .run();

        await env.OBCF_D1.prepare(
            `INSERT INTO organization_members (id, user_id, organization_id, role, status, joined_at, created_at, updated_at)
             VALUES (?, ?, ?, 'owner', 'active', ?, ?, ?)`,
        )
            .bind(crypto.randomUUID(), userId, organizationId, now, now, now)
            .run();

        return organizationId;
    } catch (error) {
        console.warn('First-user organization bootstrap skipped:', error);
        return null;
    }
}

export async function bootstrapFirstUser(
    env: AuthEnv,
    user: { id?: string; email?: string | null; name?: string | null },
) {
    if (!env.OBCF_D1 || !user?.id) return;

    try {
        const ownerRoleId = await ensureOwnerRole(env);
        if (!ownerRoleId) return;

        const now = Date.now();

        // Atomically claim the "first user" slot: only insert an owner-role grant for
        // *this* user if no owner-role grant exists yet for this role/organization at all.
        // The `WHERE NOT EXISTS` subquery and the `INSERT` execute as a single statement,
        // and D1/SQLite serializes writes to a database, so two concurrent callers can
        // never both see "no owner assigned yet" and both win -- exactly one INSERT can
        // succeed. This replaces the old `SELECT COUNT(*) FROM users` check-then-act,
        // which was a TOCTOU race letting two concurrent registrations both pass the
        // guard and both be granted the owner role.
        const claim = await env.OBCF_D1.prepare(
            `INSERT INTO user_roles (user_id, role_id, organization_id, assigned_at)
             SELECT ?, ?, ?, ?
             WHERE NOT EXISTS (
                 SELECT 1 FROM user_roles WHERE role_id = ? AND organization_id = ?
             )`,
        )
            .bind(user.id, ownerRoleId, SYSTEM_ORGANIZATION_ID, now, ownerRoleId, SYSTEM_ORGANIZATION_ID)
            .run();

        const wonOwnerClaim = (claim?.meta?.changes ?? 0) > 0;
        if (!wonOwnerClaim) return;

        const multiTenantFlag = env.MULTI_TENANT_ENABLED;
        const multiTenantEnabled = multiTenantFlag === undefined ? true : parseBooleanFlag(multiTenantFlag);
        if (multiTenantEnabled) {
            await createPersonalOrganizationIfMissing(env, user.id, user.email ?? null, user.name ?? null);
        }
    } catch (error) {
        console.warn('First-user bootstrap skipped:', error);
    }
}
