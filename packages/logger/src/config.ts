import { Logger } from './logger.js';
import { ConsoleTransport } from './transports.js';
import type { LogLevel, LoggerOptions, Transport } from './types.js';

/**
 * Environment types for logging configuration
 */
export type LogEnvironment = 'server' | 'client' | 'worker';

/**
 * Transport configuration
 */
export interface TransportConfig {
    /**
     * Whether this transport is enabled
     */
    enabled: boolean;

    /**
     * Transport-specific options
     */
    options?: Record<string, unknown>;
}

/**
 * Environment-specific logging configuration
 */
export interface EnvironmentLogConfig {
    /**
     * Log level for this environment
     */
    level?: LogLevel;

    /**
     * Console transport configuration
     */
    console?: TransportConfig;

    /**
     * File transport configuration (server-side only)
     */
    file?: TransportConfig & {
        options?: {
            path?: string;
            maxSize?: number;
            maxFiles?: number;
        };
    };

    /**
     * HTTP transport configuration
     */
    http?: TransportConfig & {
        options?: {
            url?: string;
            headers?: Record<string, string>;
            bufferSize?: number;
            flushInterval?: number;
        };
    };

    /**
     * Sentry transport configuration
     */
    sentry?: TransportConfig & {
        options?: {
            dsn?: string;
            environment?: string;
            release?: string;
            sampleRate?: number;
            tracesSampleRate?: number;
        };
    };

    /**
     * Custom transports
     */
    custom?: Record<string, TransportConfig & { transport?: Transport }>;
}

/**
 * Complete logging configuration
 */
export interface LogConfig {
    /**
     * Global log level (can be overridden per environment)
     */
    level?: LogLevel;

    /**
     * Server-side logging configuration
     */
    server?: EnvironmentLogConfig;

    /**
     * Client-side logging configuration
     */
    client?: EnvironmentLogConfig;

    /**
     * Worker (Cloudflare Workers, Service Workers) logging configuration
     */
    worker?: EnvironmentLogConfig;

    /**
     * Global context to include in all logs
     */
    context?: Record<string, unknown>;

    /**
     * Logger name
     */
    name?: string;
}

/**
 * Default log configuration
 */
export const defaultLogConfig: LogConfig = {
    level: 1, // INFO
    server: {
        console: { enabled: true },
        file: { enabled: false },
        http: { enabled: false },
        sentry: { enabled: false },
    },
    client: {
        console: { enabled: true },
        http: { enabled: false },
        sentry: { enabled: false },
    },
    worker: {
        console: { enabled: true },
        http: { enabled: false },
        sentry: { enabled: false },
    },
};

/**
 * Merge configurations with defaults
 */
function mergeConfig(config: LogConfig, defaults: LogConfig): LogConfig {
    return {
        level: config.level ?? defaults.level,
        server: { ...defaults.server, ...config.server },
        client: { ...defaults.client, ...config.client },
        worker: { ...defaults.worker, ...config.worker },
        context: { ...defaults.context, ...config.context },
        name: config.name ?? defaults.name,
    };
}

/**
 * Create transports from environment configuration
 */
export function createTransportsFromConfig(
    envConfig: EnvironmentLogConfig,
    transportFactories?: {
        console?: () => Transport;
        file?: (options?: Record<string, unknown>) => Transport;
        http?: (options?: Record<string, unknown>) => Transport;
        sentry?: (options?: Record<string, unknown>) => Transport;
    },
): Transport[] {
    const transports: Transport[] = [];

    // Console transport
    if (envConfig.console?.enabled) {
        if (transportFactories?.console) {
            transports.push(transportFactories.console());
        } else {
            transports.push(new ConsoleTransport());
        }
    }

    // File transport (server-side only)
    if (envConfig.file?.enabled && transportFactories?.file) {
        transports.push(transportFactories.file(envConfig.file.options));
    }

    // HTTP transport
    if (envConfig.http?.enabled && transportFactories?.http) {
        transports.push(transportFactories.http(envConfig.http.options));
    }

    // Sentry transport
    if (envConfig.sentry?.enabled && transportFactories?.sentry) {
        transports.push(transportFactories.sentry(envConfig.sentry.options));
    }

    // Custom transports
    if (envConfig.custom) {
        Object.keys(envConfig.custom).forEach((key) => {
            const customConfig = envConfig.custom![key];
            if (customConfig.enabled && customConfig.transport) {
                transports.push(customConfig.transport);
            }
        });
    }

    return transports;
}

/**
 * Create a logger from configuration
 */
export function createLoggerFromConfig(
    config: LogConfig,
    environment: LogEnvironment,
    transportFactories?: {
        console?: () => Transport;
        file?: (options?: Record<string, unknown>) => Transport;
        http?: (options?: Record<string, unknown>) => Transport;
        sentry?: (options?: Record<string, unknown>) => Transport;
    },
): Logger {
    const mergedConfig = mergeConfig(config, defaultLogConfig);
    const envConfig = mergedConfig[environment] || {};

    const transports = createTransportsFromConfig(envConfig, transportFactories);

    // Fallback to console when no transports enabled so the logger always has output
    const options: LoggerOptions = {
        level: envConfig.level ?? mergedConfig.level,
        name: mergedConfig.name,
        context: mergedConfig.context,
        transports: transports.length > 0 ? transports : [new ConsoleTransport()],
    };

    return new Logger(options);
}

/**
 * Helper to detect current environment
 */
export function detectEnvironment(): LogEnvironment {
    // Check for Node.js/Server first (most specific check)
    if (typeof process !== 'undefined' && process.versions?.node) {
        return 'server';
    }

    // Check for Worker environments (Cloudflare Workers, Service Workers)
    // Must check for absence of window to distinguish from browser
    if (
        typeof globalThis !== 'undefined' &&
        'caches' in globalThis &&
        'Request' in globalThis &&
        typeof (globalThis as any).window === 'undefined'
    ) {
        return 'worker';
    }

    // Default to client (browser)
    return 'client';
}

/**
 * Create a logger with automatic environment detection
 */
export function createAutoLogger(
    config: LogConfig,
    transportFactories?: {
        console?: () => Transport;
        file?: (options?: Record<string, unknown>) => Transport;
        http?: (options?: Record<string, unknown>) => Transport;
        sentry?: (options?: Record<string, unknown>) => Transport;
    },
): Logger {
    const environment = detectEnvironment();
    return createLoggerFromConfig(config, environment, transportFactories);
}
