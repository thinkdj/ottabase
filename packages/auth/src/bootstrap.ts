import { makeSlug } from '@ottabase/utils/url';
import type { AuthEnv } from './backend-handler';

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
        const existing = await env.OBCF_D1.prepare(`SELECT id FROM roles WHERE name = ? LIMIT 1`)
            .bind(OWNER_ROLE_NAME)
            .first<any>();

        if (existing?.id) {
            return String(existing.id);
        }

        const roleId = crypto.randomUUID();
        const now = Date.now();

        await env.OBCF_D1.prepare(
            `INSERT INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
            .bind(roleId, OWNER_ROLE_NAME, 'System owner with full privileges', JSON.stringify(['*:*']), 1, now, now)
            .run();

        return roleId;
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
            `INSERT INTO organization_members (user_id, organization_id, role, status, joined_at)
             VALUES (?, ?, 'owner', 'active', ?)`,
        )
            .bind(userId, organizationId, now)
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
        const countRow = await env.OBCF_D1.prepare(`SELECT COUNT(*) as count FROM users`).first<any>();
        const totalUsers = Number(countRow?.count ?? countRow?.['count(*)'] ?? 0);

        if (totalUsers !== 1) return;

        const ownerRoleId = await ensureOwnerRole(env);
        if (!ownerRoleId) return;

        const now = Date.now();

        await env.OBCF_D1.prepare(
            `INSERT OR IGNORE INTO user_roles (user_id, role_id, organization_id, assigned_at)
             VALUES (?, ?, ?, ?)`,
        )
            .bind(user.id, ownerRoleId, SYSTEM_ORGANIZATION_ID, now)
            .run();

        const multiTenantFlag = (env as any).MULTI_TENANT_ENABLED;
        const multiTenantEnabled = multiTenantFlag === undefined ? true : parseBooleanFlag(multiTenantFlag);
        if (multiTenantEnabled) {
            await createPersonalOrganizationIfMissing(env, user.id, user.email ?? null, user.name ?? null);
        }
    } catch (error) {
        console.warn('First-user bootstrap skipped:', error);
    }
}
