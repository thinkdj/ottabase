import type { D1Database } from '@cloudflare/workers-types';

/**
 * Returns true if the user must complete a second factor (TOTP and/or WebAuthn) after password validation.
 */
export async function userRequiresTwoFactor(d1: D1Database, userId: string): Promise<boolean> {
    const row = await d1
        .prepare(
            `SELECT u.totp_enabled_at as totpEnabledAt,
              (SELECT COUNT(*) FROM authenticators WHERE user_id = u.id) as passkeyCount
       FROM users u WHERE u.id = ?`,
        )
        .bind(userId)
        .first<{ totpEnabledAt: number | null; passkeyCount: number }>();

    if (!row) return false;
    const totpOn = row.totpEnabledAt != null && Number(row.totpEnabledAt) > 0;
    const passkeys = Number(row.passkeyCount) || 0;
    return totpOn || passkeys > 0;
}

/**
 * Remove TOTP, backup codes, and all WebAuthn credentials (e.g. after password reset).
 */
export async function clearUserTwoFactor(d1: D1Database, userId: string): Promise<void> {
    await d1
        .prepare(
            `UPDATE users SET totp_secret_enc = NULL, totp_enabled_at = NULL, backup_codes_json = NULL WHERE id = ?`,
        )
        .bind(userId)
        .run();
    await d1.prepare(`DELETE FROM authenticators WHERE user_id = ?`).bind(userId).run();
}

export async function loadUserForSession(
    d1: D1Database,
    userId: string,
): Promise<{
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    emailVerified: number | null;
} | null> {
    const row = await d1
        .prepare(`SELECT id, name, email, image, email_verified as emailVerified FROM users WHERE id = ?`)
        .bind(userId)
        .first<{
            id: string;
            name: string | null;
            email: string;
            image: string | null;
            emailVerified: number | null;
        }>();

    if (!row) return null;
    return {
        id: row.id,
        email: row.email,
        name: row.name ?? null,
        image: row.image ?? null,
        emailVerified: row.emailVerified != null ? Number(row.emailVerified) : null,
    };
}
