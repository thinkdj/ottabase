// ============================================================
// @ottabase/auth - First-User Bootstrap
// ============================================================
//
// Detects the very first user sign-in and auto-assigns the
// system 'owner' role + creates a personal organization.
//
// Uses raw D1 queries (not OttaORM) to stay consistent with
// the auth callback layer which doesn't depend on model init.
// ============================================================

import type { D1Database } from '@cloudflare/workers-types';

/** Well-known ID for the system 'owner' role (matches migration 003). */
const SYSTEM_OWNER_ROLE_ID = '00000000-0000-0000-0000-000000000000';

/** Sentinel value for system-scoped user_roles rows. */
const SYSTEM_ORG_ID = 'system';

/**
 * Bootstrap the first user as system owner.
 *
 * Call this from the signIn callback after a successful sign-in.
 * It is idempotent — safe to call on every sign-in; it short-circuits
 * unless this is genuinely the first-and-only user in the DB.
 *
 * @returns `true` if the user was bootstrapped as owner, `false` otherwise.
 */
export async function bootstrapFirstUser(
    userId: string,
    db: D1Database,
    options?: {
        /** User email — used to derive the personal org name. */
        userEmail?: string;
        /** User display name. */
        userName?: string;
        /** Skip personal org creation (e.g. if multi-tenant is disabled). */
        skipOrgCreation?: boolean;
    },
): Promise<boolean> {
    try {
        // ── Quick guard: count users ──────────────────────────
        const countResult = await db
            .prepare(`SELECT count(*) as cnt FROM users`)
            .first<{ cnt: number }>();

        if (!countResult || countResult.cnt !== 1) {
            return false; // Not the first user — bail out
        }

        // ── Ensure the 'owner' role exists ────────────────────
        const ownerRole = await db
            .prepare(`SELECT id FROM roles WHERE name = 'owner' LIMIT 1`)
            .first<{ id: string }>();

        let ownerRoleId: string;
        if (ownerRole) {
            ownerRoleId = ownerRole.id;
        } else {
            // Fallback: create the role on-the-fly (migration 003 should have done this)
            ownerRoleId = SYSTEM_OWNER_ROLE_ID;
            await db
                .prepare(
                    `INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
                     VALUES (?, 'owner', 'System owner - full platform access across all organizations', '["*:*"]', 1, unixepoch(), unixepoch())`,
                )
                .bind(ownerRoleId)
                .run();
        }

        // ── Check if user already has the owner role ──────────
        const existingRole = await db
            .prepare(
                `SELECT user_id FROM user_roles WHERE user_id = ? AND role_id = ? AND organization_id = ? LIMIT 1`,
            )
            .bind(userId, ownerRoleId, SYSTEM_ORG_ID)
            .first();

        if (existingRole) {
            return false; // Already bootstrapped
        }

        // ── Assign system-scoped owner role ───────────────────
        await db
            .prepare(
                `INSERT OR IGNORE INTO user_roles (user_id, role_id, organization_id, app_id, assigned_at, assigned_by)
                 VALUES (?, ?, ?, NULL, unixepoch(), 'system-bootstrap')`,
            )
            .bind(userId, ownerRoleId, SYSTEM_ORG_ID)
            .run();

        // ── Create personal organization (unless skipped) ─────
        if (!options?.skipOrgCreation) {
            await createPersonalOrg(db, userId, options?.userEmail, options?.userName);
        }

        // ── Audit log ─────────────────────────────────────────
        try {
            await db
                .prepare(
                    `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, metadata, status, created_at)
                     VALUES (?, ?, 'system.bootstrap', 'user', ?, '{"event":"first_user_bootstrap"}', 'success', unixepoch())`,
                )
                .bind(crypto.randomUUID(), userId, userId)
                .run();
        } catch {
            // Audit logging is best-effort — don't block bootstrap
        }

        console.log(`[ottabase] First-user bootstrap complete: ${userId} is now system owner`);
        return true;
    } catch (error) {
        console.error('[ottabase] First-user bootstrap failed:', error);
        return false;
    }
}

/**
 * Create a personal organization for the bootstrapped user.
 */
async function createPersonalOrg(
    db: D1Database,
    userId: string,
    email?: string,
    name?: string,
): Promise<void> {
    const orgName = name ? `${name}'s Organization` : email ? `${email.split('@')[0]}'s Organization` : 'My Organization';
    const orgSlug = generateSlug(orgName);
    const orgId = crypto.randomUUID();

    try {
        // Check if organizations table exists (it may not before migration 002)
        const tableCheck = await db
            .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='organizations'`)
            .first();
        if (!tableCheck) return;

        // Don't create if user already owns an org
        const existingOrg = await db
            .prepare(`SELECT id FROM organizations WHERE owner_id = ? LIMIT 1`)
            .bind(userId)
            .first();
        if (existingOrg) return;

        await db
            .prepare(
                `INSERT INTO organizations (id, name, slug, owner_id, plan, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'free', 'active', unixepoch(), unixepoch())`,
            )
            .bind(orgId, orgName, orgSlug, userId)
            .run();

        // Add user as org owner member
        const membersTableCheck = await db
            .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='organization_members'`)
            .first();
        if (membersTableCheck) {
            await db
                .prepare(
                    `INSERT OR IGNORE INTO organization_members (user_id, organization_id, role, status, joined_at)
                     VALUES (?, ?, 'owner', 'active', unixepoch())`,
                )
                .bind(userId, orgId)
                .run();
        }

        // Also assign the admin RBAC role scoped to this org
        const adminRole = await db
            .prepare(`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`)
            .first<{ id: string }>();
        if (adminRole) {
            await db
                .prepare(
                    `INSERT OR IGNORE INTO user_roles (user_id, role_id, organization_id, app_id, assigned_at, assigned_by)
                     VALUES (?, ?, ?, NULL, unixepoch(), 'system-bootstrap')`,
                )
                .bind(userId, adminRole.id, orgId)
                .run();
        }
    } catch (error) {
        // Org creation is best-effort during bootstrap
        console.warn('[ottabase] Personal org creation during bootstrap skipped:', error);
    }
}

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
