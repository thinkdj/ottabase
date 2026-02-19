import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNoopMailer, sendTemplatedEmail } from '../mailer';
import type { Mailer } from '../types';

describe('Mailer utilities', () => {
    describe('createNoopMailer', () => {
        it('should create a noop mailer', () => {
            const mailer = createNoopMailer();
            expect(mailer.provider).toBe('noop');
            expect(typeof mailer.send).toBe('function');
        });

        it('should always return success', async () => {
            const mailer = createNoopMailer();
            const result = await mailer.send({
                from: 'test@example.com',
                to: 'user@example.com',
                subject: 'Test',
                html: '<p>Test</p>',
            });

            expect(result.success).toBe(true);
            expect(result.provider).toBe('noop');
            expect(result.id).toBe('noop');
        });
    });

    describe('sendTemplatedEmail', () => {
        let mockMailer: Mailer;

        beforeEach(() => {
            mockMailer = {
                provider: 'test',
                send: vi.fn().mockResolvedValue({
                    provider: 'test',
                    success: true,
                    id: 'test-id',
                }),
            };
        });

        it('should render template and send email', async () => {
            const result = await sendTemplatedEmail(mockMailer, {
                from: 'sender@example.com',
                to: 'user@example.com',
                template: 'default',
                subject: 'Hello {{name}}',
                variables: { name: 'World' },
                content: {
                    header: 'Welcome',
                    body: '<p>Hi {{name}}!</p>',
                    footer: 'Thanks',
                },
            });

            expect(result.success).toBe(true);
            expect(mockMailer.send).toHaveBeenCalledTimes(1);

            const call = (mockMailer.send as any).mock.calls[0][0];
            expect(call.subject).toBe('Hello World');
            expect(call.html).toContain('Hi World!');
            expect(call.text).toBeDefined();
        });

        it('should use custom subject override', async () => {
            await sendTemplatedEmail(mockMailer, {
                from: 'sender@example.com',
                to: 'user@example.com',
                template: 'default',
                subject: 'Custom Subject',
                content: {
                    body: '<p>Body</p>',
                },
            });

            const call = (mockMailer.send as any).mock.calls[0][0];
            expect(call.subject).toBe('Custom Subject');
        });

        it('should pass through email fields', async () => {
            await sendTemplatedEmail(mockMailer, {
                from: 'sender@example.com',
                to: ['user1@example.com', 'user2@example.com'],
                cc: 'cc@example.com',
                bcc: 'bcc@example.com',
                replyTo: 'reply@example.com',
                template: 'default',
                subject: 'Test',
                content: {
                    body: '<p>Body</p>',
                },
            });

            const call = (mockMailer.send as any).mock.calls[0][0];
            expect(call.from).toBe('sender@example.com');
            expect(call.to).toEqual(['user1@example.com', 'user2@example.com']);
            expect(call.cc).toBe('cc@example.com');
            expect(call.bcc).toBe('bcc@example.com');
            expect(call.replyTo).toBe('reply@example.com');
        });

        it('should handle mailer errors', async () => {
            const errorMailer: Mailer = {
                provider: 'error',
                send: vi.fn().mockResolvedValue({
                    provider: 'error',
                    success: false,
                    error: 'Send failed',
                }),
            };

            const result = await sendTemplatedEmail(errorMailer, {
                from: 'sender@example.com',
                to: 'user@example.com',
                template: 'default',
                subject: 'Test',
                content: {
                    body: '<p>Body</p>',
                },
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Send failed');
        });
    });
});
