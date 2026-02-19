import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BufferedTransport,
    ConsoleTransport,
    FilterTransport,
    MemoryTransport,
    MultiTransport,
} from '../transports.js';
import type { LogEntry } from '../types.js';

describe('Transports', () => {
    const createLogEntry = (level: number, message: string): LogEntry => ({
        level,
        levelName: level === 0 ? 'debug' : level === 1 ? 'info' : level === 2 ? 'warn' : 'error',
        message,
        timestamp: new Date(),
    });

    describe('ConsoleTransport', () => {
        beforeEach(() => {
            vi.spyOn(console, 'debug').mockImplementation(() => {});
            vi.spyOn(console, 'info').mockImplementation(() => {});
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should log to console.debug for DEBUG level', () => {
            const transport = new ConsoleTransport();
            transport.log(createLogEntry(0, 'test'));
            expect(console.debug).toHaveBeenCalled();
        });

        it('should log to console.info for INFO level', () => {
            const transport = new ConsoleTransport();
            transport.log(createLogEntry(1, 'test'));
            expect(console.info).toHaveBeenCalled();
        });

        it('should log to console.warn for WARN level', () => {
            const transport = new ConsoleTransport();
            transport.log(createLogEntry(2, 'test'));
            expect(console.warn).toHaveBeenCalled();
        });

        it('should log to console.error for ERROR level', () => {
            const transport = new ConsoleTransport();
            transport.log(createLogEntry(3, 'test'));
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('MemoryTransport', () => {
        it('should store logs in memory', () => {
            const transport = new MemoryTransport();
            const entry = createLogEntry(1, 'test');
            transport.log(entry);

            const logs = transport.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0]).toEqual(entry);
        });

        it('should respect maxSize limit', () => {
            const transport = new MemoryTransport({ maxSize: 2 });
            transport.log(createLogEntry(1, 'test 1'));
            transport.log(createLogEntry(1, 'test 2'));
            transport.log(createLogEntry(1, 'test 3'));

            const logs = transport.getLogs();
            expect(logs).toHaveLength(2);
            expect(logs[0].message).toBe('test 2');
            expect(logs[1].message).toBe('test 3');
        });

        it('should clear logs', () => {
            const transport = new MemoryTransport();
            transport.log(createLogEntry(1, 'test'));
            transport.clear();

            const logs = transport.getLogs();
            expect(logs).toHaveLength(0);
        });

        it('should clear logs on close', () => {
            const transport = new MemoryTransport();
            transport.log(createLogEntry(1, 'test'));
            transport.close();

            const logs = transport.getLogs();
            expect(logs).toHaveLength(0);
        });
    });

    describe('BufferedTransport', () => {
        it('should buffer logs and flush when buffer is full', async () => {
            const onFlush = vi.fn();
            const transport = new BufferedTransport({
                bufferSize: 2,
                onFlush,
            });

            transport.log(createLogEntry(1, 'test 1'));
            expect(onFlush).not.toHaveBeenCalled();

            transport.log(createLogEntry(1, 'test 2'));
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(onFlush).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ message: 'test 1' })]),
            );

            await transport.close();
        });

        it('should flush logs on close', async () => {
            const onFlush = vi.fn();
            const transport = new BufferedTransport({
                bufferSize: 10,
                onFlush,
            });

            transport.log(createLogEntry(1, 'test'));
            await transport.close();

            expect(onFlush).toHaveBeenCalled();
        });

        it('should flush logs manually', async () => {
            const onFlush = vi.fn();
            const transport = new BufferedTransport({
                bufferSize: 10,
                onFlush,
            });

            transport.log(createLogEntry(1, 'test'));
            await transport.flush();

            expect(onFlush).toHaveBeenCalled();
            await transport.close();
        });
    });

    describe('MultiTransport', () => {
        it('should log to all transports', async () => {
            const transport1 = new MemoryTransport();
            const transport2 = new MemoryTransport();
            const multi = new MultiTransport([transport1, transport2]);

            const entry = createLogEntry(1, 'test');
            await multi.log(entry);

            expect(transport1.getLogs()).toHaveLength(1);
            expect(transport2.getLogs()).toHaveLength(1);
        });

        it('should add transports dynamically', async () => {
            const transport1 = new MemoryTransport();
            const multi = new MultiTransport([transport1]);

            await multi.log(createLogEntry(1, 'test 1'));

            const transport2 = new MemoryTransport();
            multi.addTransport(transport2);

            await multi.log(createLogEntry(1, 'test 2'));

            expect(transport1.getLogs()).toHaveLength(2);
            expect(transport2.getLogs()).toHaveLength(1);
        });

        it('should remove transports dynamically', async () => {
            const transport1 = new MemoryTransport();
            const transport2 = new MemoryTransport();
            const multi = new MultiTransport([transport1, transport2]);

            await multi.log(createLogEntry(1, 'test 1'));

            multi.removeTransport(transport2);

            await multi.log(createLogEntry(1, 'test 2'));

            expect(transport1.getLogs()).toHaveLength(2);
            expect(transport2.getLogs()).toHaveLength(1);
        });

        it('should flush all transports', async () => {
            const transport1 = new MemoryTransport();
            const transport2 = new MemoryTransport();
            const multi = new MultiTransport([transport1, transport2]);

            transport1.flush = vi.fn();
            transport2.flush = vi.fn();

            await multi.flush();

            expect(transport1.flush).toHaveBeenCalled();
            expect(transport2.flush).toHaveBeenCalled();
        });

        it('should close all transports', async () => {
            const transport1 = new MemoryTransport();
            const transport2 = new MemoryTransport();
            const multi = new MultiTransport([transport1, transport2]);

            transport1.close = vi.fn();
            transport2.close = vi.fn();

            await multi.close();

            expect(transport1.close).toHaveBeenCalled();
            expect(transport2.close).toHaveBeenCalled();
        });
    });

    describe('FilterTransport', () => {
        it('should filter logs based on predicate', async () => {
            const memory = new MemoryTransport();
            const filter = new FilterTransport(memory, (entry) => entry.level >= 2);

            await filter.log(createLogEntry(1, 'info'));
            await filter.log(createLogEntry(2, 'warn'));
            await filter.log(createLogEntry(3, 'error'));

            const logs = memory.getLogs();
            expect(logs).toHaveLength(2);
            expect(logs[0].levelName).toBe('warn');
            expect(logs[1].levelName).toBe('error');
        });

        it('should forward flush to wrapped transport', async () => {
            const memory = new MemoryTransport();
            memory.flush = vi.fn();

            const filter = new FilterTransport(memory, () => true);
            await filter.flush();

            expect(memory.flush).toHaveBeenCalled();
        });

        it('should forward close to wrapped transport', async () => {
            const memory = new MemoryTransport();
            memory.close = vi.fn();

            const filter = new FilterTransport(memory, () => true);
            await filter.close();

            expect(memory.close).toHaveBeenCalled();
        });
    });
});
