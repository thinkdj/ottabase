'use server';

/**
 * Safe way to access environment variables with type checking
 * @param key - Environment variable key
 * @param defaultValue - Optional default value
 */
export const getEnvVar = (key: string, defaultValue?: string): string => {
    const value = process.env[key];
    if (!value && defaultValue === undefined) {
        throw new Error(`Environment variable ${key} is not defined`);
    }
    return value ?? defaultValue ?? '';
};

/**
 * Environment type for type safety
 */
export type Environment = 'development' | 'production' | 'test' | 'staging';

/**
 * Check if running in development environment
 */
export const isDev = ['dev', 'development'].includes(process.env.NODE_ENV?.toLowerCase() ?? '');

/**
 * Check if running in production environment
 */
export const isProd = ['prod', 'production'].includes(process.env.NODE_ENV?.toLowerCase() ?? '');

/**
 * Check if running in test environment
 */
export const isTest = ['test', 'testing'].includes(process.env.NODE_ENV?.toLowerCase() ?? '');

/**
 * Check if running in staging environment
 */
export const isStaging = ['stage', 'staging'].includes(process.env.NODE_ENV?.toLowerCase() ?? '');

/**
 * Check if running on server (Node.js environment)
 */
export const isRunningOnServer = typeof window === 'undefined';

/**
 * Check if running on client (browser environment)
 */
export const isRunningOnClient = !isRunningOnServer;

/**
 * Get current environment with type safety
 */
export const getEnvironment = (): Environment => {
    if (isDev) return 'development';
    if (isTest) return 'test';
    if (isStaging) return 'staging';
    return 'production';
};

/**
 * Check if application is running in CI/CD environment
 */
export const isCI = (): boolean => {
    return Boolean(process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI || process.env.CIRCLECI);
};
