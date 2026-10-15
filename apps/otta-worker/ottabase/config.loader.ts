// ============================================================
// App identity. otta-web resolves a full ottabase.config.ts; a single Worker needs three
// values, all from env. The function keeps otta-web's name so package compositions copied
// from there (`otta add` does that) work unchanged.
// ============================================================

export interface WorkerConfig {
    /** Tenancy key every package scopes by. Stable for the life of the deployment. */
    appId: string;
    appName: string;
    environment: 'development' | 'preview' | 'staging' | 'production' | string;
}

export function getOttabaseConfig(env: CloudflareEnv): WorkerConfig {
    const appId = env.APP_ID?.trim() || 'otta-worker';
    return { appId, appName: appId, environment: env.ENVIRONMENT?.trim() || 'development' };
}

export function isDevelopment(env: CloudflareEnv): boolean {
    return getOttabaseConfig(env).environment === 'development';
}
