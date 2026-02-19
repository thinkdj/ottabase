import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCloudflareMailer } from '../providers/cloudflare';
import type { SendEmailInput } from '../types';

describe('Cloudflare Mailer', () => {
    let mockSend: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockSend = vi.fn();
    });

    it('should create a mailer with default provider name', () => {
        const mailer = createCloudflareMailer({
            send: mockSend,
        });

        expect(mailer.provider).toBe('cloudflare');
        expect(typeof mailer.send).toBe('function');
    });

    it('should create a mailer with custom provider name', () => {
        const mailer = createCloudflareMailer({
            send: mockSend,
            providerName: 'custom-cloudflare',
        });

        expect(mailer.provider).toBe('custom-cloudflare');
    });

    it('should call custom send function', async () => {
        mockSend.mockResolvedValue({ id: 'custom-id-123' });

        const mailer = createCloudflareMailer({
            send: mockSend,
        });

        const input: SendEmailInput = {
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
        };

        const result = await mailer.send(input);

        expect(result.success).toBe(true);
        expect(result.provider).toBe('cloudflare');
        expect(result.id).toBe('custom-id-123');
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(input);
    });

    it('should handle send function returning void', async () => {
        mockSend.mockResolvedValue(undefined);

        const mailer = createCloudflareMailer({
            send: mockSend,
        });

        const result = await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
        });

        expect(result.success).toBe(true);
        expect(result.id).toBeUndefined();
        expect(result.raw).toBeUndefined();
    });

    it('should handle send function errors', async () => {
        mockSend.mockRejectedValue(new Error('Send failed'));

        const mailer = createCloudflareMailer({
            send: mockSend,
        });

        const result = await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
        });

        expect(result.success).toBe(false);
        expect(result.provider).toBe('cloudflare');
        expect(result.error).toBe('Send failed');
    });

    it('should handle non-Error exceptions', async () => {
        mockSend.mockRejectedValue('String error');

        const mailer = createCloudflareMailer({
            send: mockSend,
        });

        const result = await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown error');
    });

    it('should pass through all email fields', async () => {
        mockSend.mockResolvedValue({ id: 'test-id' });

        const mailer = createCloudflareMailer({
            send: mockSend,
        });

        const input: SendEmailInput = {
            from: 'sender@example.com',
            to: ['user1@example.com', 'user2@example.com'],
            cc: 'cc@example.com',
            bcc: 'bcc@example.com',
            replyTo: 'reply@example.com',
            subject: 'Test Subject',
            html: '<p>HTML</p>',
            text: 'Text',
            headers: {
                'X-Custom': 'value',
            },
            tags: ['tag1'],
        };

        await mailer.send(input);

        expect(mockSend).toHaveBeenCalledWith(input);
    });

    it('should include raw result in response', async () => {
        const rawResult = {
            id: 'test-id',
            status: 'queued',
            metadata: { custom: 'data' },
        };

        mockSend.mockResolvedValue(rawResult);

        const mailer = createCloudflareMailer({
            send: mockSend,
        });

        const result = await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
        });

        expect(result.raw).toEqual(rawResult);
    });
});
