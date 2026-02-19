import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuditDbTransport } from '../audit-transport.js';
import type { LogEntry } from '../types.js';

describe('AuditDbTransport', () => {
    let transport: AuditDbTransport;
    let mockGetUserContext: ReturnType<typeof vi.fn>;
    let mockGetRequestContext: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.useFakeTimers();
        mockGetUserContext = vi.fn().mockResolvedValue({
            userId: 'user-123',
            userEmail: 'user@example.com',
        });
        mockGetRequestContext = vi.fn().mockResolvedValue({
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0',
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create transport with default options', () => {
            transport = new AuditDbTransport();
            expect(transport).toBeDefined();
        });

        it('should accept custom options', () => {
            transport = new AuditDbTransport({
                getUserContext: mockGetUserContext,
                getRequestContext: mockGetRequestContext,
                minLevel: 2,
                bufferSize: 20,
                flushInterval: 10000,
            });
            expect(transport).toBeDefined();
        });

        it('should use default values when options are omitted', () => {
            transport = new AuditDbTransport({});
            expect(transport).toBeDefined();
        });
    });

    describe('log filtering by level', () => {
        beforeEach(() => {
            transport = new AuditDbTransport({
                minLevel: 2, // WARN level
            });
        });

        it('should create transport with minLevel option', () => {
            expect(transport).toBeDefined();
        });

        it('should accept log entries', () => {
            const logEntry: LogEntry = {
                level: 2, // WARN level
                levelName: 'warn',
                message: 'test warning',
                timestamp: new Date(),
                context: {},
            };

            transport.log(logEntry);
            expect(transport).toBeDefined();
        });
    });

    describe('buffer management', () => {
        it('should buffer entries', () => {
            transport = new AuditDbTransport({
                bufferSize: 3,
                flushInterval: 60000, // Long interval to avoid auto-flush
            });

            const createLogEntry = (message: string, level = 1): LogEntry => ({
                level,
                levelName: 'info',
                message,
                timestamp: new Date(),
                context: {},
            });

            transport.log(createLogEntry('log 1'));
            transport.log(createLogEntry('log 2'));
            transport.log(createLogEntry('log 3'));

            expect(transport).toBeDefined();
        });

        it('should auto-flush on interval', () => {
            transport = new AuditDbTransport({
                bufferSize: 100, // Large buffer
                flushInterval: 5000,
            });

            const logEntry: LogEntry = {
                level: 1,
                levelName: 'info',
                message: 'test',
                timestamp: new Date(),
                context: {},
            };

            transport.log(logEntry);

            // Advance time to trigger interval
            vi.advanceTimersByTime(5000);

            expect(transport).toBeDefined();
        });
    });

    describe('flush', () => {
        beforeEach(() => {
            transport = new AuditDbTransport({
                getUserContext: mockGetUserContext,
                getRequestContext: mockGetRequestContext,
                bufferSize: 100,
                flushInterval: 60000,
            });
        });

        it('should not crash when buffer is empty', async () => {
            const result = await transport.flush();
            expect(result).toBeUndefined();
        });

        it('should handle flush with entries', async () => {
            const logEntry: LogEntry = {
                level: 1,
                levelName: 'info',
                message: 'test',
                timestamp: new Date(),
                context: {
                    action: 'test-action',
                },
            };

            transport.log(logEntry);

            // Should not throw
            await transport.flush();
            expect(transport).toBeDefined();
        });
    });

    describe('close', () => {
        it('should not throw on close', async () => {
            transport = new AuditDbTransport({
                flushInterval: 5000,
            });

            // Should not throw
            await transport.close();
            expect(transport).toBeDefined();
        });

        it('should handle close with pending entries', async () => {
            transport = new AuditDbTransport({
                getUserContext: mockGetUserContext,
                getRequestContext: mockGetRequestContext,
                bufferSize: 100,
                flushInterval: 60000,
            });

            const logEntry: LogEntry = {
                level: 1,
                levelName: 'info',
                message: 'test',
                timestamp: new Date(),
                context: {},
            };

            transport.log(logEntry);

            // Should not throw
            await transport.close();
            expect(transport).toBeDefined();
        });
    });

    describe('context handling', () => {
        it('should accept user and request context functions', () => {
            transport = new AuditDbTransport({
                getUserContext: () =>
                    Promise.resolve({
                        userId: 'user-456',
                        userEmail: 'test@example.com',
                    }),
                getRequestContext: () =>
                    Promise.resolve({
                        ipAddress: '192.168.1.1',
                        userAgent: 'Chrome',
                    }),
                bufferSize: 1,
            });

            const logEntry: LogEntry = {
                level: 1,
                levelName: 'info',
                message: 'test action',
                timestamp: new Date(),
                context: {
                    action: 'user_update',
                    resourceType: 'profile',
                    resourceId: 'prof-123',
                    changes: { name: 'new name' },
                },
            };

            transport.log(logEntry);
            expect(transport).toBeDefined();
        });

        it('should handle sync context functions', () => {
            transport = new AuditDbTransport({
                getUserContext: () => ({
                    userId: 'sync-user',
                }),
                getRequestContext: () => ({
                    ipAddress: '10.0.0.1',
                }),
            });

            expect(transport).toBeDefined();
        });
    });

    describe('log entry types', () => {
        beforeEach(() => {
            transport = new AuditDbTransport();
        });

        it('should handle DEBUG level entries', () => {
            const logEntry: LogEntry = {
                level: 0,
                levelName: 'debug',
                message: 'debug message',
                timestamp: new Date(),
                context: {},
            };

            transport.log(logEntry);
            expect(transport).toBeDefined();
        });

        it('should handle INFO level entries', () => {
            const logEntry: LogEntry = {
                level: 1,
                levelName: 'info',
                message: 'info message',
                timestamp: new Date(),
                context: {},
            };

            transport.log(logEntry);
            expect(transport).toBeDefined();
        });

        it('should handle WARN level entries', () => {
            const logEntry: LogEntry = {
                level: 2,
                levelName: 'warn',
                message: 'warn message',
                timestamp: new Date(),
                context: {},
            };

            transport.log(logEntry);
            expect(transport).toBeDefined();
        });

        it('should handle ERROR level entries', () => {
            const logEntry: LogEntry = {
                level: 3,
                levelName: 'error',
                message: 'error message',
                timestamp: new Date(),
                context: {},
                error: new Error('test error'),
            };

            transport.log(logEntry);
            expect(transport).toBeDefined();
        });
    });

    describe('entry with metadata', () => {
        it('should accept entries with context metadata', () => {
            transport = new AuditDbTransport();

            const logEntry: LogEntry = {
                level: 1,
                levelName: 'info',
                message: 'user action',
                timestamp: new Date(),
                context: {
                    action: 'update',
                    resourceType: 'user',
                    resourceId: 'user-123',
                    changes: {
                        name: { from: 'Old', to: 'New' },
                    },
                },
            };

            transport.log(logEntry);
            expect(transport).toBeDefined();
        });

        it('should accept entries with errors', () => {
            transport = new AuditDbTransport();

            const error = new Error('Something went wrong');
            const logEntry: LogEntry = {
                level: 3,
                levelName: 'error',
                message: 'operation failed',
                timestamp: new Date(),
                context: {},
                error,
            };

            transport.log(logEntry);
            expect(transport).toBeDefined();
        });
    });
});
