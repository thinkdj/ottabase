/**
 * @ottabase/logger
 *
 * Extensible logger for Ottabase with support for multiple transports and formatters
 */

export { Logger, createLogger } from './logger.js';
export type { ILogger, LogEntry, LogLevel, LogLevelName, LoggerOptions, Transport, Formatter } from './types.js';
export { LogLevel as LogLevelEnum } from './types.js';

// Re-export common transports and formatters
export { ConsoleTransport, MemoryTransport, FileTransport, SentryTransport } from './transports.js';
export { prettyFormatter, jsonFormatter, simpleFormatter, createFormatter } from './formatters.js';

// Re-export configuration utilities
export {
    createLoggerFromConfig,
    createAutoLogger,
    createTransportsFromConfig,
    detectEnvironment,
    defaultLogConfig,
} from './config.js';
export type { LogConfig, EnvironmentLogConfig, TransportConfig, LogEnvironment } from './config.js';

/**
 * Default logger instance
 */
export { default } from './default.js';
