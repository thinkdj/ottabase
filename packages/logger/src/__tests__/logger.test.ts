import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger, createLogger } from '../logger.js';
import { MemoryTransport } from '../transports.js';
import type { Transport } from '../types.js';

describe('Logger', () => {
    let memoryTransport: MemoryTransport;

    beforeEach(() => {
        memoryTransport = new MemoryTransport();
    });

    describe('createLogger', () => {
        it('should create a logger instance', () => {
            const logger = createLogger();
            expect(logger).toBeInstanceOf(Logger);
        });

        it('should create a logger with custom options', () => {
            const logger = createLogger({
                level: 0, // DEBUG
                name: 'test',
                transports: [memoryTransport],
            });
            expect(logger.getLevel()).toBe(0);
        });
    });

    describe('log levels', () => {
        it('should log debug messages', () => {
            const logger = new Logger({
                level: 0,
                transports: [memoryTransport],
            });

            logger.debug('test debug');
            const logs = memoryTransport.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].levelName).toBe('debug');
            expect(logs[0].message).toBe('test debug');
        });

        it('should log info messages', () => {
            const logger = new Logger({
                level: 1,
                transports: [memoryTransport],
            });

            logger.info('test info');
            const logs = memoryTransport.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].levelName).toBe('info');
            expect(logs[0].message).toBe('test info');
        });

        it('should log warn messages', () => {
            const logger = new Logger({
                level: 2,
                transports: [memoryTransport],
            });

            logger.warn('test warn');
            const logs = memoryTransport.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].levelName).toBe('warn');
            expect(logs[0].message).toBe('test warn');
        });

        it('should log error messages', () => {
            const logger = new Logger({
                level: 3,
                transports: [memoryTransport],
            });

            const error = new Error('test error');
            logger.error('test error message', error);
            const logs = memoryTransport.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].levelName).toBe('error');
            expect(logs[0].message).toBe('test error message');
            expect(logs[0].error).toBe(error);
        });
    });

    describe('log level filtering', () => {
        it('should not log messages below the configured level', () => {
            const logger = new Logger({
                level: 2, // WARN
                transports: [memoryTransport],
            });

            logger.debug('debug');
            logger.info('info');
            logger.warn('warn');
            logger.error('error');

            const logs = memoryTransport.getLogs();
            expect(logs).toHaveLength(2);
            expect(logs[0].levelName).toBe('warn');
            expect(logs[1].levelName).toBe('error');
        });

        it('should allow changing log level', () => {
            const logger = new Logger({
                level: 2, // WARN
                transports: [memoryTransport],
            });

            logger.info('info 1');
            expect(memoryTransport.getLogs()).toHaveLength(0);

            logger.setLevel(1); // INFO
            logger.info('info 2');
            expect(memoryTransport.getLogs()).toHaveLength(1);
        });
    });

    describe('context', () => {
        it('should include logger context in all messages', () => {
            const logger = new Logger({
                level: 1,
                transports: [memoryTransport],
                context: { service: 'test', version: '1.0' },
            });

            logger.info('test');
            const logs = memoryTransport.getLogs();
            expect(logs[0].context).toEqual({ service: 'test', version: '1.0' });
        });

        it('should merge message context with logger context', () => {
            const logger = new Logger({
                level: 1,
                transports: [memoryTransport],
                context: { service: 'test' },
            });

            logger.info('test', { userId: 123 });
            const logs = memoryTransport.getLogs();
            expect(logs[0].context).toEqual({ service: 'test', userId: 123 });
        });

        it('should create child loggers with additional context', () => {
            const logger = new Logger({
                level: 1,
                transports: [memoryTransport],
                context: { service: 'test' },
            });

            const child = logger.child({ userId: 123 });
            child.info('test');

            const logs = memoryTransport.getLogs();
            expect(logs[0].context).toEqual({ service: 'test', userId: 123 });
        });

        it('should not affect parent logger context', () => {
            const logger = new Logger({
                level: 1,
                transports: [memoryTransport],
                context: { service: 'test' },
            });

            const child = logger.child({ userId: 123 });
            child.info('child message');
            logger.info('parent message');

            const logs = memoryTransport.getLogs();
            expect(logs[0].context).toEqual({ service: 'test', userId: 123 });
            expect(logs[1].context).toEqual({ service: 'test' });
        });
    });

    describe('transports', () => {
        it('should support multiple transports', () => {
            const transport1 = new MemoryTransport();
            const transport2 = new MemoryTransport();

            const logger = new Logger({
                level: 1,
                transports: [transport1, transport2],
            });

            logger.info('test');

            expect(transport1.getLogs()).toHaveLength(1);
            expect(transport2.getLogs()).toHaveLength(1);
        });

        it('should add transports dynamically', () => {
            const logger = new Logger({
                level: 1,
                transports: [memoryTransport],
            });

            logger.info('test 1');

            const transport2 = new MemoryTransport();
            logger.addTransport(transport2);

            logger.info('test 2');

            expect(memoryTransport.getLogs()).toHaveLength(2);
            expect(transport2.getLogs()).toHaveLength(1);
        });

        it('should remove transports dynamically', () => {
            const transport2 = new MemoryTransport();
            const logger = new Logger({
                level: 1,
                transports: [memoryTransport, transport2],
            });

            logger.info('test 1');

            logger.removeTransport(transport2);

            logger.info('test 2');

            expect(memoryTransport.getLogs()).toHaveLength(2);
            expect(transport2.getLogs()).toHaveLength(1);
        });
    });

    describe('flush and close', () => {
        it('should flush all transports', async () => {
            const mockTransport: Transport = {
                log: vi.fn(),
                flush: vi.fn(),
            };

            const logger = new Logger({
                level: 1,
                transports: [mockTransport],
            });

            await logger.flush();

            expect(mockTransport.flush).toHaveBeenCalled();
        });

        it('should close all transports', async () => {
            const mockTransport: Transport = {
                log: vi.fn(),
                close: vi.fn(),
            };

            const logger = new Logger({
                level: 1,
                transports: [mockTransport],
            });

            await logger.close();

            expect(mockTransport.close).toHaveBeenCalled();
        });
    });

    describe('logger name', () => {
        it('should include logger name in log entries', () => {
            const logger = new Logger({
                level: 1,
                name: 'my-logger',
                transports: [memoryTransport],
            });

            logger.info('test');

            const logs = memoryTransport.getLogs();
            expect(logs[0].name).toBe('my-logger');
        });
    });

    describe('timestamps', () => {
        it('should include timestamps in log entries', () => {
            const logger = new Logger({
                level: 1,
                transports: [memoryTransport],
            });

            logger.info('test');

            const logs = memoryTransport.getLogs();
            expect(logs[0].timestamp).toBeInstanceOf(Date);
        });
    });
});
