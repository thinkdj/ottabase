import type { PreAuthSecretEnv } from './pre-auth-token';

export function getWebAuthnRpId(env: PreAuthSecretEnv & { AUTH_URL?: string; NEXTAUTH_URL?: string }): string {
    const raw = env.AUTH_URL || env.NEXTAUTH_URL || 'http://127.0.0.1:3003';
    try {
        return new URL(raw).hostname;
    } catch {
        return 'localhost';
    }
}

export function getWebAuthnRpName(env: PreAuthSecretEnv & { APP_NAME?: string }): string {
    return typeof env.APP_NAME === 'string' && env.APP_NAME ? env.APP_NAME : 'Ottabase';
}
