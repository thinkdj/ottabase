import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    detectEnvironment,
    createLoggerFromConfig,
    createAutoLogger,
    createTransportsFromConfig,
    defaultLogConfig,
    type LogConfig,
} from '../config.js';
import { MemoryTransport, ConsoleTransport } from '../transports.js';
import { Logger } from '../logger.js';
import { LogLevel } from '../types.js';

const LogLevelEnum = {
    DEBUG: 0 as LogLevel,
    INFO: 1 as LogLevel,
    WARN: 2 as LogLevel,
    ERROR: 3 as LogLevel,
    SILENT: 4 as LogLevel,
};

describe('Config', () => {
    describe('detectEnvironment', () => {
        let originalProcess: any;
        let originalWindow: any;

        beforeEach(() => {
            originalProcess = (globalThis as any).process;
            originalWindow = (globalThis as any).window;
        });

        afterEach(() => {
            (globalThis as any).process = originalProcess;
            (globalThis as any).window = originalWindow;
        });

        it('should detect server environment in Node.js', () => {
            (globalThis as any).process = { versions: { node: '18.0.0' } };
            expect(detectEnvironment()).toBe('server');
        });

        it('should detect worker environment', () => {
            (globalThis as any).process = undefined;
            (globalThis as any).window = undefined;
            (globalThis as any).caches = {};
            (globalThis as any).Request = class {};

            expect(detectEnvironment()).toBe('worker');
        });

        it('should detect client environment by default', () => {
            (globalThis as any).process = undefined;
            (globalThis as any).window = {};

            expect(detectEnvironment()).toBe('client');
        });

        it('should prefer server over worker when both match', () => {
            (globalThis as any).process = { versions: { node: '18.0.0' } };
            (globalThis as any).caches = {};
            (globalThis as any).Request = class {};

            expect(detectEnvironment()).toBe('server');
        });
    });

    describe('createTransportsFromConfig', () => {
        it('should create console transport when enabled', () => {
            const transports = createTransportsFromConfig({
                console: { enabled: true },
            });

            expect(transports).toHaveLength(1);
            expect(transports[0]).toBeInstanceOf(ConsoleTransport);
        });

        it('should not create console transport when disabled', () => {
            const transports = createTransportsFromConfig({
                console: { enabled: false },
            });

            expect(transports).toHaveLength(0);
        });

        it('should use custom transport factories', () => {
            const customTransport = new MemoryTransport();
            const transports = createTransportsFromConfig(
                {
                    console: { enabled: true },
                },
                {
                    console: () => customTransport,
                },
            );

            expect(transports).toHaveLength(1);
            expect(transports[0]).toBe(customTransport);
        });

        it('should create file transport when factory provided', () => {
            const fileTransport = new MemoryTransport();
            const transports = createTransportsFromConfig(
                {
                    file: {
                        enabled: true,
                        options: { path: '/logs/app.log' },
                    },
                },
                {
                    file: () => fileTransport,
                },
            );

            expect(transports).toHaveLength(1);
            expect(transports[0]).toBe(fileTransport);
        });

        it('should not create file transport without factory', () => {
            const transports = createTransportsFromConfig({
                file: {
                    enabled: true,
                    options: { path: '/logs/app.log' },
                },
            });

            expect(transports).toHaveLength(0);
        });

        it('should create multiple transports', () => {
            const transports = createTransportsFromConfig(
                {
                    console: { enabled: true },
                    http: { enabled: true },
                },
                {
                    http: () => new MemoryTransport(),
                },
            );

            expect(transports).toHaveLength(2);
        });

        it('should include custom transports', () => {
            const customTransport = new MemoryTransport();
            const transports = createTransportsFromConfig({
                custom: {
                    myTransport: {
                        enabled: true,
                        transport: customTransport,
                    },
                },
            });

            expect(transports).toHaveLength(1);
            expect(transports[0]).toBe(customTransport);
        });

        it('should not include disabled custom transports', () => {
            const customTransport = new MemoryTransport();
            const transports = createTransportsFromConfig({
                custom: {
                    myTransport: {
                        enabled: false,
                        transport: customTransport,
                    },
                },
            });

            expect(transports).toHaveLength(0);
        });
    });

    describe('createLoggerFromConfig', () => {
        it('should create logger with correct level', () => {
            const config: LogConfig = {
                level: LogLevelEnum.DEBUG,
                server: {
                    console: { enabled: true },
                },
            };

            const logger = createLoggerFromConfig(config, 'server');

            expect(logger).toBeInstanceOf(Logger);
            expect(logger.getLevel()).toBe(LogLevelEnum.DEBUG);
        });

        it('should use environment-specific level', () => {
            const config: LogConfig = {
                level: LogLevelEnum.INFO,
                server: {
                    level: LogLevelEnum.DEBUG,
                    console: { enabled: true },
                },
            };

            const logger = createLoggerFromConfig(config, 'server');

            expect(logger.getLevel()).toBe(LogLevelEnum.DEBUG);
        });

        it('should fall back to global level', () => {
            const config: LogConfig = {
                level: LogLevelEnum.WARN,
                server: {
                    console: { enabled: true },
                },
            };

            const logger = createLoggerFromConfig(config, 'server');

            expect(logger.getLevel()).toBe(LogLevelEnum.WARN);
        });

        it('should merge with default config', () => {
            const config: LogConfig = {
                server: {
                    console: { enabled: false },
                },
            };

            const logger = createLoggerFromConfig(config, 'server');

            expect(logger.getLevel()).toBe(defaultLogConfig.level);
        });

        it('should include global context', () => {
            const memoryTransport = new MemoryTransport();
            const config: LogConfig = {
                context: { app: 'test' },
                server: {
                    console: { enabled: true },
                },
            };

            const logger = createLoggerFromConfig(config, 'server', {
                console: () => memoryTransport,
            });

            logger.info('test message');
            const logs = memoryTransport.getLogs();

            expect(logs[0].context).toEqual({ app: 'test' });
        });

        it('should create fallback console transport when no transports enabled', () => {
            const config: LogConfig = {
                server: {
                    console: { enabled: false },
                },
            };

            const logger = createLoggerFromConfig(config, 'server');

            expect(logger).toBeInstanceOf(Logger);
        });

        it('should use different config for different environments', () => {
            const config: LogConfig = {
                server: {
                    level: LogLevelEnum.DEBUG,
                },
                client: {
                    level: LogLevelEnum.ERROR,
                },
            };

            const serverLogger = createLoggerFromConfig(config, 'server');
            const clientLogger = createLoggerFromConfig(config, 'client');

            expect(serverLogger.getLevel()).toBe(LogLevelEnum.DEBUG);
            expect(clientLogger.getLevel()).toBe(LogLevelEnum.ERROR);
        });
    });

    describe('createAutoLogger', () => {
        it('should create logger based on detected environment', () => {
            const config: LogConfig = {
                level: LogLevelEnum.INFO,
            };

            const logger = createAutoLogger(config);

            expect(logger).toBeInstanceOf(Logger);
            expect(logger.getLevel()).toBe(LogLevelEnum.INFO);
        });

        it('should use transport factories', () => {
            const memoryTransport = new MemoryTransport();
            const config: LogConfig = {
                server: {
                    console: { enabled: true },
                },
            };

            const logger = createAutoLogger(config, {
                console: () => memoryTransport,
            });

            logger.info('test');
            expect(memoryTransport.getLogs()).toHaveLength(1);
        });
    });
});
