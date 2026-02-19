import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCronHandler, CronHandler } from '../handler';
import type { ScheduledEvent, ExecutionContext } from '../types';

// Mock Cloudflare types
const createMockEvent = (cron: string): ScheduledEvent => ({
    cron,
    scheduledTime: Date.now(),
    type: 'scheduled',
});

const createMockCtx = (): ExecutionContext => ({
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
});

interface TestEnv {
    DB: { query: () => Promise<void> };
}

describe('CronHandler', () => {
    let mockEnv: TestEnv;
    let mockCtx: ExecutionContext;

    beforeEach(() => {
        mockEnv = {
            DB: { query: vi.fn().mockResolvedValue(undefined) },
        };
        mockCtx = createMockCtx();
    });

    describe('createCronHandler', () => {
        it('should create a CronHandler instance', () => {
            const handler = createCronHandler<TestEnv>();
            expect(handler).toBeInstanceOf(CronHandler);
        });

        it('should support chainable API', () => {
            const handler = createCronHandler<TestEnv>()
                .on('0 0 * * *', async () => {})
                .on('0 * * * *', async () => {});

            expect(handler.getJobs()).toHaveLength(2);
        });
    });

    describe('on()', () => {
        it('should register a handler for a cron expression', () => {
            const handler = createCronHandler<TestEnv>().on('0 0 * * *', async () => {});

            const jobs = handler.getJobs();
            expect(jobs).toHaveLength(1);
            expect(jobs[0].cron).toBe('0 0 * * *');
        });

        it('should register handler with optional name', () => {
            const handler = createCronHandler<TestEnv>().on('0 0 * * *', async () => {}, 'daily-cleanup');

            const jobs = handler.getJobs();
            expect(jobs[0].name).toBe('daily-cleanup');
        });

        it('should allow multiple handlers for different cron expressions', () => {
            const handler = createCronHandler<TestEnv>()
                .on('0 0 * * *', async () => {})
                .on('0 * * * *', async () => {})
                .on('*/5 * * * *', async () => {});

            expect(handler.getJobs()).toHaveLength(3);
        });
    });

    describe('handler', () => {
        it('should execute matching handler', async () => {
            const mockFn = vi.fn();
            const cron = createCronHandler<TestEnv>().on('0 0 * * *', mockFn);

            const event = createMockEvent('0 0 * * *');
            await cron.handler(event, mockEnv, mockCtx);

            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should pass correct context to handler', async () => {
            const mockFn = vi.fn();
            const cron = createCronHandler<TestEnv>().on('0 0 * * *', mockFn);

            const event = createMockEvent('0 0 * * *');
            await cron.handler(event, mockEnv, mockCtx);

            const context = mockFn.mock.calls[0][0];
            expect(context.env).toBe(mockEnv);
            expect(context.event).toBe(event);
            expect(context.ctx).toBe(mockCtx);
            expect(context.cron).toBe('0 0 * * *');
            expect(context.scheduledTime).toBeInstanceOf(Date);
        });

        it('should not execute non-matching handlers', async () => {
            const mockFn1 = vi.fn();
            const mockFn2 = vi.fn();

            const cron = createCronHandler<TestEnv>().on('0 0 * * *', mockFn1).on('0 * * * *', mockFn2);

            const event = createMockEvent('0 0 * * *');
            await cron.handler(event, mockEnv, mockCtx);

            expect(mockFn1).toHaveBeenCalledTimes(1);
            expect(mockFn2).not.toHaveBeenCalled();
        });

        it('should warn when no handler is registered for cron expression', async () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const cron = createCronHandler<TestEnv>();

            const event = createMockEvent('0 0 * * *');
            await cron.handler(event, mockEnv, mockCtx);

            expect(consoleSpy).toHaveBeenCalledWith('[cron] No handler registered for: 0 0 * * *');
            consoleSpy.mockRestore();
        });
    });

    describe('hooks', () => {
        it('should call onBeforeJob before handler', async () => {
            const order: string[] = [];
            const onBeforeJob = vi.fn(() => order.push('before'));
            const handler = vi.fn(() => order.push('handler'));

            const cron = createCronHandler<TestEnv>({ onBeforeJob }).on('0 0 * * *', handler);

            await cron.handler(createMockEvent('0 0 * * *'), mockEnv, mockCtx);

            expect(order).toEqual(['before', 'handler']);
        });

        it('should call onAfterJob after handler', async () => {
            const order: string[] = [];
            const onAfterJob = vi.fn(() => order.push('after'));
            const handler = vi.fn(() => order.push('handler'));

            const cron = createCronHandler<TestEnv>({ onAfterJob }).on('0 0 * * *', handler);

            await cron.handler(createMockEvent('0 0 * * *'), mockEnv, mockCtx);

            expect(order).toEqual(['handler', 'after']);
        });

        it('should call onError when handler throws', async () => {
            const error = new Error('Test error');
            const onError = vi.fn();
            const handler = vi.fn(() => {
                throw error;
            });

            const cron = createCronHandler<TestEnv>({ onError }).on('0 0 * * *', handler);

            await cron.handler(createMockEvent('0 0 * * *'), mockEnv, mockCtx);

            expect(onError).toHaveBeenCalledWith(error, expect.any(Object));
        });

        it('should rethrow error when no onError hook provided', async () => {
            const error = new Error('Test error');
            const handler = vi.fn(() => {
                throw error;
            });

            const cron = createCronHandler<TestEnv>().on('0 0 * * *', handler);

            await expect(cron.handler(createMockEvent('0 0 * * *'), mockEnv, mockCtx)).rejects.toThrow('Test error');
        });
    });

    describe('multiple handlers for same cron', () => {
        it('should execute all handlers for same cron expression', async () => {
            const mockFn1 = vi.fn();
            const mockFn2 = vi.fn();

            const cron = createCronHandler<TestEnv>().on('0 0 * * *', mockFn1).on('0 0 * * *', mockFn2);

            await cron.handler(createMockEvent('0 0 * * *'), mockEnv, mockCtx);

            expect(mockFn1).toHaveBeenCalledTimes(1);
            expect(mockFn2).toHaveBeenCalledTimes(1);
        });
    });
});
