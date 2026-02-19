// ============================================================
// @ottabase/notifications - Manager Tests
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationManager } from '../manager';
import type { Notification, NotificationChannelHandler, SendResult } from '../types';

// Mock email channel
class MockEmailChannel implements NotificationChannelHandler {
    name = 'email' as const;
    sentNotifications: Notification[] = [];

    async send(notification: Notification): Promise<SendResult> {
        this.sentNotifications.push(notification);
        return {
            success: true,
            messageId: notification.id,
            metadata: { provider: 'mock-email' },
        };
    }

    async isAvailable(): Promise<boolean> {
        return true;
    }

    reset() {
        this.sentNotifications = [];
    }
}

// Mock websocket channel
class MockWebSocketChannel implements NotificationChannelHandler {
    name = 'websocket' as const;
    sentNotifications: Notification[] = [];

    async send(notification: Notification): Promise<SendResult> {
        this.sentNotifications.push(notification);
        return {
            success: true,
            messageId: notification.id,
            metadata: { provider: 'mock-websocket' },
        };
    }

    async isAvailable(): Promise<boolean> {
        return true;
    }

    reset() {
        this.sentNotifications = [];
    }
}

describe('NotificationManager', () => {
    let manager: NotificationManager;
    let emailChannel: MockEmailChannel;
    let wsChannel: MockWebSocketChannel;

    beforeEach(() => {
        manager = new NotificationManager({
            defaultChannels: ['email'],
            email: { from: 'noreply@test.com' },
        });

        emailChannel = new MockEmailChannel();
        wsChannel = new MockWebSocketChannel();

        manager.registerChannel(emailChannel);
        manager.registerChannel(wsChannel);

        emailChannel.reset();
        wsChannel.reset();
    });

    describe('notify', () => {
        it('should send notification via default channel', async () => {
            const results = await manager.notify({
                recipient: {
                    userId: '123',
                    email: 'user@test.com',
                },
                payload: {
                    title: 'Test Notification',
                    message: 'This is a test',
                },
            });

            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(true);
            expect(emailChannel.sentNotifications).toHaveLength(1);
            expect(wsChannel.sentNotifications).toHaveLength(0);
        });

        it('should send notification via multiple channels', async () => {
            const results = await manager.notify({
                recipient: {
                    userId: '123',
                    email: 'user@test.com',
                    channels: ['email', 'websocket'],
                },
                payload: {
                    title: 'Multi-Channel Test',
                    message: 'Sent to multiple channels',
                },
            });

            expect(results).toHaveLength(2);
            expect(emailChannel.sentNotifications).toHaveLength(1);
            expect(wsChannel.sentNotifications).toHaveLength(1);
        });

        it('should set correct notification properties', async () => {
            await manager.notify({
                recipient: {
                    userId: '123',
                    email: 'user@test.com',
                },
                payload: {
                    title: 'Test Title',
                    message: 'Test Message',
                    category: 'test',
                    actionUrl: 'https://test.com',
                    actionText: 'Click Here',
                    metadata: { key: 'value' },
                },
                options: {
                    priority: 'high',
                },
            });

            const sent = emailChannel.sentNotifications[0];
            expect(sent.payload.title).toBe('Test Title');
            expect(sent.payload.message).toBe('Test Message');
            expect(sent.payload.category).toBe('test');
            expect(sent.payload.actionUrl).toBe('https://test.com');
            expect(sent.payload.actionText).toBe('Click Here');
            expect(sent.payload.metadata).toEqual({ key: 'value' });
            expect(sent.options?.priority).toBe('high');
        });

        it('should generate unique notification IDs', async () => {
            await manager.notify({
                recipient: { userId: '1', email: 'user1@test.com' },
                payload: { title: 'Test 1', message: 'Message 1' },
            });

            await manager.notify({
                recipient: { userId: '2', email: 'user2@test.com' },
                payload: { title: 'Test 2', message: 'Message 2' },
            });

            const id1 = emailChannel.sentNotifications[0].id;
            const id2 = emailChannel.sentNotifications[1].id;

            expect(id1).toBeDefined();
            expect(id2).toBeDefined();
            expect(id1).not.toBe(id2);
        });
    });

    describe('channel management', () => {
        it('should register channels', () => {
            expect(manager.hasChannel('email')).toBe(true);
            expect(manager.hasChannel('websocket')).toBe(true);
        });

        it('should get registered channels', () => {
            const channels = manager.getChannels();
            expect(channels).toContain('email');
            expect(channels).toContain('websocket');
        });

        it('should handle missing channels gracefully', async () => {
            const results = await manager.notify({
                recipient: {
                    userId: '123',
                    email: 'user@test.com',
                    channels: ['email', 'system'] as any,
                },
                payload: {
                    title: 'Test',
                    message: 'Test message',
                },
            });

            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true); // email
            expect(results[1].success).toBe(false); // system (not registered)
            expect(results[1].error).toContain('not registered');
        });
    });

    describe('system notifications', () => {
        it('should send system notifications', async () => {
            const systemChannel = {
                name: 'system' as const,
                async send(notification: Notification): Promise<SendResult> {
                    return {
                        success: true,
                        messageId: notification.id,
                    };
                },
                async isAvailable() {
                    return true;
                },
            };

            manager.registerChannel(systemChannel);

            const result = await manager.notifySystem({
                title: 'System Alert',
                message: 'Something went wrong',
                eventType: 'system.error',
                severity: 'critical',
            });

            expect(result.success).toBe(true);
        });

        it('should fail if system channel not registered', async () => {
            const result = await manager.notifySystem({
                title: 'System Alert',
                message: 'Something went wrong',
                eventType: 'system.error',
                severity: 'critical',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('System channel not registered');
        });
    });

    describe('async queue notifications', () => {
        it('should dispatch notification to queue when async option is enabled', async () => {
            const dispatchedJobs: any[] = [];
            const mockQueue = {
                async dispatch(queueName: string, payload: any, options?: any) {
                    dispatchedJobs.push({ queueName, payload, options });
                },
            };

            manager.setQueue(mockQueue);

            const results = await manager.notify({
                recipient: {
                    userId: '123',
                    email: 'user@test.com',
                },
                payload: {
                    title: 'Async Test',
                    message: 'This should be queued',
                },
                options: {
                    async: true,
                },
            });

            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(true);
            expect(results[0].metadata?.async).toBe(true);
            expect(dispatchedJobs).toHaveLength(1);
            expect(dispatchedJobs[0].queueName).toBe('notifications');
            expect(dispatchedJobs[0].payload.notification).toBeDefined();
            expect(dispatchedJobs[0].payload.channels).toEqual(['email']);
        });

        it('should return error when async is enabled but queue is not configured', async () => {
            const results = await manager.notify({
                recipient: {
                    userId: '123',
                    email: 'user@test.com',
                },
                payload: {
                    title: 'Async Test',
                    message: 'This should fail',
                },
                options: {
                    async: true,
                },
            });

            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(false);
            expect(results[0].error).toContain('Queue not configured');
        });
    });

    describe('queue handler integration', () => {
        it('should process queued notifications via queue handler', async () => {
            const { createNotificationQueueHandler } = await import('../queue');

            const handler = createNotificationQueueHandler(manager);

            const job = {
                payload: {
                    notification: {
                        id: 'test-123',
                        recipient: {
                            userId: '123',
                            email: 'user@test.com',
                        },
                        payload: {
                            title: 'Queue Test',
                            message: 'Processed from queue',
                        },
                        options: {
                            priority: 'normal' as const,
                        },
                        status: 'pending' as const,
                        createdAt: new Date(),
                    },
                    channels: ['email' as const, 'websocket' as const],
                },
            };

            await handler(job);

            expect(emailChannel.sentNotifications).toHaveLength(1);
            expect(wsChannel.sentNotifications).toHaveLength(1);
            expect(emailChannel.sentNotifications[0].payload.title).toBe('Queue Test');
        });

        it('should throw error when channel send fails to trigger retry', async () => {
            const { createNotificationQueueHandler } = await import('../queue');

            // Create a failing channel
            const failingChannel = {
                name: 'failing' as const,
                async send(): Promise<SendResult> {
                    return {
                        success: false,
                        error: 'Intentional failure',
                    };
                },
                async isAvailable() {
                    return true;
                },
            };

            manager.registerChannel(failingChannel);

            const handler = createNotificationQueueHandler(manager);

            const job = {
                payload: {
                    notification: {
                        id: 'test-456',
                        recipient: {
                            userId: '123',
                            email: 'user@test.com',
                        },
                        payload: {
                            title: 'Fail Test',
                            message: 'This will fail',
                        },
                        options: {
                            priority: 'normal' as const,
                        },
                        status: 'pending' as const,
                        createdAt: new Date(),
                    },
                    channels: ['failing' as const],
                },
            };

            // Suppress console.error for this test only (expected error)
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            try {
                // Should throw to allow queue retry
                await expect(handler(job)).rejects.toThrow('Failed to send notification');
            } finally {
                spy.mockRestore();
            }
        });
    });
});
