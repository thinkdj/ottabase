import type { AuthEnv, CredentialsAuthorizeOptions } from '../auth-types';
import { verifyPassword } from '../password-hash';
import { verifyPreAuthToken } from './pre-auth-token';
import { loadUserForSession, userRequiresTwoFactor } from './two-factor-db';

/**
 * Credentials authorize: supports (1) preAuthToken after 2FA, (2) email+password when 2FA not required.
 * When 2FA is enabled, password-only sign-in returns null (client must use /api/auth/two-factor/* flow).
 */
export async function credentialsAuthorizeWithTwoFactor(
    credentials: Record<string, unknown>,
    env: AuthEnv,
    options?: CredentialsAuthorizeOptions,
): Promise<any> {
    const email = typeof credentials.email === 'string' ? credentials.email.trim().toLowerCase() : '';
    const preAuthToken = typeof credentials.preAuthToken === 'string' ? credentials.preAuthToken.trim() : '';

    if (preAuthToken && email) {
        const payload = await verifyPreAuthToken(preAuthToken, env);
        if (!payload || payload.typ !== '2fa-ok' || payload.email !== email) {
            return null;
        }
        if (!env.OBCF_D1) {
            throw new Error('OBCF_D1 database binding is required for authentication');
        }
        const user = await loadUserForSession(env.OBCF_D1, payload.sub);
        if (!user || user.email.toLowerCase() !== email) {
            return null;
        }
        return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
            emailVerified: user.emailVerified,
        };
    }

    const password = typeof credentials.password === 'string' ? credentials.password : '';
    const minLength = options?.minPasswordLength ?? 6;

    if (!email || !password) {
        return null;
    }

    if (password.length < minLength) {
        return null;
    }

    if (!env.OBCF_D1) {
        throw new Error('OBCF_D1 database binding is required for credentials authentication');
    }

    let result: any | null = null;
    try {
        result = await env.OBCF_D1.prepare(
            `SELECT id, name, email, image, email_verified, password_hash
                 FROM users
                 WHERE email = ?`,
        )
            .bind(email)
            .first<any>();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('no such column: email_verified') || message.includes('no such column: password_hash')) {
            throw new Error('Missing auth columns on users table. Run /api/ottaorm/init to apply migrations.');
        }
        throw error;
    }

    if (!result || !result.password_hash) {
        if (result && !result.password_hash) {
            console.warn('Credentials sign-in failed: user has no password_hash (OAuth-only or missing migration).');
        }
        return null;
    }

    const valid = await verifyPassword(password, String(result.password_hash));
    if (!valid) {
        return null;
    }

    const emailVerifiedMs = result.email_verified ? Number(result.email_verified) : null;
    if (options?.requireVerifiedEmail && !emailVerifiedMs) {
        return null;
    }

    const needs2fa = await userRequiresTwoFactor(env.OBCF_D1, String(result.id));
    if (needs2fa) {
        return null;
    }

    return {
        id: result.id,
        email: result.email,
        name: result.name ?? undefined,
        image: result.image ?? undefined,
        emailVerified: emailVerifiedMs,
    };
}
