import type { LogConfig } from '@ottabase/logger';
import { LogLevelEnum } from '@ottabase/logger';

// Safe access for non-Vite environments (SSR, tests) where import.meta.env may be undefined
const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
const isDev = env?.DEV ?? false;

/**
 * Logging configuration for the application
 *
 * Configure logging behavior for different environments (server, client, worker)
 * and enable/disable different transports per environment.
 *
 * Example usage:
 * ```ts
 * import { createLoggerFromConfig } from '@ottabase/logger';
 * import { logConfig } from './log.config';
 *
 * const logger = createLoggerFromConfig(logConfig, 'client');
 * logger.info('Application started');
 * ```
 */
export const logConfig: LogConfig = {
    // Global log level (can be overridden per environment)
    level: isDev ? LogLevelEnum.DEBUG : LogLevelEnum.INFO,

    // Global context to include in all logs
    context: {
        app: 'otta-web',
        version: env?.VITE_APP_VERSION ?? '0.0.0',
    },

    // Server-side logging configuration
    server: {
        // Console logging - enabled for development and production
        console: {
            enabled: true,
        },

        // File logging - only enabled in production for server-side
        file: {
            enabled: !isDev,
            options: {
                path: './logs/app.log',
                maxSize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5,
            },
        },

        // HTTP logging - send logs to external service
        http: {
            enabled: false,
            options: {
                url: env?.VITE_LOG_ENDPOINT ?? 'https://logs.example.com',
                bufferSize: 100,
                flushInterval: 5000,
            },
        },

        // Sentry - error tracking and monitoring
        sentry: {
            enabled: !isDev,
            options: {
                dsn: env?.VITE_SENTRY_DSN,
                environment: env?.MODE ?? 'production',
                sampleRate: 1.0,
                tracesSampleRate: 0.1,
            },
        },
    },

    // Client-side logging configuration
    client: {
        level: isDev ? LogLevelEnum.DEBUG : LogLevelEnum.WARN,

        // Console logging - enabled in development, limited in production
        console: {
            enabled: true,
        },

        // HTTP logging - send client logs to server
        http: {
            enabled: !isDev,
            options: {
                url: '/api/logs',
                bufferSize: 50,
                flushInterval: 10000,
            },
        },

        // Sentry - client-side error tracking
        sentry: {
            enabled: !isDev,
            options: {
                dsn: env?.VITE_SENTRY_DSN,
                environment: env?.MODE ?? 'production',
                sampleRate: 0.5, // Sample 50% of client events
                tracesSampleRate: 0.05,
            },
        },
    },

    // Worker logging configuration (Cloudflare Workers, Service Workers)
    worker: {
        // Console logging - enabled for workers
        console: {
            enabled: true,
        },

        // HTTP logging - send worker logs to external service
        http: {
            enabled: false,
            options: {
                url: env?.VITE_LOG_ENDPOINT,
                bufferSize: 100,
                flushInterval: 5000,
            },
        },

        // Sentry - worker error tracking
        sentry: {
            enabled: !isDev,
            options: {
                dsn: env?.VITE_SENTRY_DSN,
                environment: env?.MODE ?? 'production',
            },
        },
    },
};

/**
 * Development-only log configuration
 * Use this for verbose logging during development
 */
export const devLogConfig: LogConfig = {
    level: LogLevelEnum.DEBUG,
    context: {
        app: 'otta-web',
        environment: 'development',
    },
    server: {
        console: { enabled: true },
        file: { enabled: false },
    },
    client: {
        console: { enabled: true },
    },
    worker: {
        console: { enabled: true },
    },
};

/**
 * Production log configuration
 * Optimized for production with minimal console logging
 */
export const prodLogConfig: LogConfig = {
    level: LogLevelEnum.INFO,
    context: {
        app: 'otta-web',
        environment: 'production',
    },
    server: {
        console: { enabled: false }, // Disable console in production
        file: {
            enabled: true,
            options: {
                path: './logs/app.log',
                maxSize: 10 * 1024 * 1024,
                maxFiles: 5,
            },
        },
        sentry: {
            enabled: true,
            options: {
                dsn: env?.VITE_SENTRY_DSN,
                environment: 'production',
            },
        },
    },
    client: {
        level: LogLevelEnum.ERROR,
        console: { enabled: false },
        sentry: {
            enabled: true,
            options: {
                dsn: env?.VITE_SENTRY_DSN,
                environment: 'production',
            },
        },
    },
    worker: {
        console: { enabled: false },
        sentry: {
            enabled: true,
            options: {
                dsn: env?.VITE_SENTRY_DSN,
                environment: 'production',
            },
        },
    },
};
