import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createResendMailer } from '../providers/resend';

// Mock global fetch
global.fetch = vi.fn();

describe('Resend Mailer', () => {
    const mockOptions = {
        apiKey: 're_test_123456789',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create a mailer with correct provider', () => {
        const mailer = createResendMailer(mockOptions);
        expect(mailer.provider).toBe('resend');
        expect(typeof mailer.send).toBe('function');
    });

    it('should use default base URL when not provided', async () => {
        const mailer = createResendMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({
                id: 'test-id',
            }),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
        });

        const call = (global.fetch as any).mock.calls[0];
        expect(call[0]).toBe('https://api.resend.com/emails');
    });

    it('should use custom base URL when provided', async () => {
        const mailer = createResendMailer({
            ...mockOptions,
            baseUrl: 'https://custom.resend.com',
        });
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ id: 'test-id' }),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
        });

        const call = (global.fetch as any).mock.calls[0];
        expect(call[0]).toBe('https://custom.resend.com/emails');
    });

    it('should send email successfully', async () => {
        const mailer = createResendMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({
                id: 'resend-email-id-123',
            }),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        const result = await mailer.send({
            from: 'noreply@example.com',
            to: 'user@example.com',
            subject: 'Test Subject',
            html: '<p>Test body</p>',
        });

        expect(result.success).toBe(true);
        expect(result.provider).toBe('resend');
        expect(result.id).toBe('resend-email-id-123');
        expect(global.fetch).toHaveBeenCalledTimes(1);

        const call = (global.fetch as any).mock.calls[0];
        expect(call[1].method).toBe('POST');
        expect(call[1].headers.Authorization).toBe(`Bearer ${mockOptions.apiKey}`);
        expect(call[1].headers['Content-Type']).toBe('application/json');
    });

    it('should format email addresses correctly', async () => {
        const mailer = createResendMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ id: 'test-id' }),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        await mailer.send({
            from: { email: 'sender@example.com', name: 'Sender Name' },
            to: ['user1@example.com', { email: 'user2@example.com', name: 'User 2' }],
            subject: 'Test',
            html: '<p>Test</p>',
        });

        const call = (global.fetch as any).mock.calls[0];
        const payload = JSON.parse(call[1].body);

        expect(payload.from).toBe('Sender Name <sender@example.com>');
        expect(payload.to).toEqual(['user1@example.com', 'User 2 <user2@example.com>']);
    });

    it('should handle CC and BCC addresses', async () => {
        const mailer = createResendMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ id: 'test-id' }),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        await mailer.send({
            from: 'sender@example.com',
            to: 'to@example.com',
            cc: ['cc1@example.com', 'cc2@example.com'],
            bcc: 'bcc@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
        });

        const call = (global.fetch as any).mock.calls[0];
        const payload = JSON.parse(call[1].body);

        expect(payload.cc).toEqual(['cc1@example.com', 'cc2@example.com']);
        expect(payload.bcc).toEqual(['bcc@example.com']);
    });

    it('should handle reply-to addresses', async () => {
        const mailer = createResendMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ id: 'test-id' }),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
            replyTo: { email: 'reply@example.com', name: 'Reply Name' },
        });

        const call = (global.fetch as any).mock.calls[0];
        const payload = JSON.parse(call[1].body);

        expect(payload.reply_to).toBe('Reply Name <reply@example.com>');
    });

    it('should handle text and HTML content', async () => {
        const mailer = createResendMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ id: 'test-id' }),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>HTML body</p>',
            text: 'Plain text body',
        });

        const call = (global.fetch as any).mock.calls[0];
        const payload = JSON.parse(call[1].body);

        expect(payload.html).toBe('<p>HTML body</p>');
        expect(payload.text).toBe('Plain text body');
    });

    it('should handle headers and tags', async () => {
        const mailer = createResendMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ id: 'test-id' }),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
            headers: {
                'X-Custom-Header': 'value',
            },
            tags: ['tag1', 'tag2'],
        });

        const call = (global.fetch as any).mock.calls[0];
        const payload = JSON.parse(call[1].body);

        expect(payload.headers).toEqual({
            'X-Custom-Header': 'value',
        });
        expect(payload.tags).toEqual([{ name: 'tag1' }, { name: 'tag2' }]);
    });

    it('should remove undefined fields from payload', async () => {
        const mailer = createResendMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ id: 'test-id' }),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
            // No cc, bcc, text, replyTo, headers, tags
        });

        const call = (global.fetch as any).mock.calls[0];
        const payload = JSON.parse(call[1].body);

        expect(payload.cc).toBeUndefined();
        expect(payload.bcc).toBeUndefined();
        expect(payload.text).toBeUndefined();
        expect(payload.reply_to).toBeUndefined();
        expect(payload.headers).toBeUndefined();
        expect(payload.tags).toBeUndefined();
    });

    it('should handle Resend API errors', async () => {
        const mailer = createResendMailer(mockOptions);
        const mockResponse = {
            ok: false,
            status: 400,
            json: vi.fn().mockResolvedValue({
                message: 'Invalid email address',
            }),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        const result = await mailer.send({
            from: 'invalid',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
        });

        expect(result.success).toBe(false);
        expect(result.provider).toBe('resend');
        expect(result.error).toBe('Invalid email address');
        expect(result.raw).toBeDefined();
    });

    it('should handle network errors', async () => {
        const mailer = createResendMailer(mockOptions);

        (global.fetch as any).mockRejectedValue(new Error('Network error'));

        const result = await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
    });

    it('should handle invalid JSON responses', async () => {
        const mailer = createResendMailer(mockOptions);
        const mockResponse = {
            ok: false,
            status: 500,
            json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        const result = await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Resend request failed (500)');
    });
});
