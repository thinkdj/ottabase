import { createHash, createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSESMailer } from '../providers/ses';

// Mock global fetch
global.fetch = vi.fn();

describe('SES Mailer', () => {
    const mockOptions = {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create a mailer with correct provider', () => {
        const mailer = createSESMailer(mockOptions);
        expect(mailer.provider).toBe('ses');
        expect(typeof mailer.send).toBe('function');
    });

    it('should use default region when not provided', () => {
        const mailer = createSESMailer({
            accessKeyId: mockOptions.accessKeyId,
            secretAccessKey: mockOptions.secretAccessKey,
        });
        expect(mailer.provider).toBe('ses');
    });

    it('should send email successfully', async () => {
        const mailer = createSESMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({
                MessageId: '0100018a-fb3c-4c89-96a1-2b0b0c8d9e6f-000000',
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
        expect(result.provider).toBe('ses');
        expect(result.id).toBe('0100018a-fb3c-4c89-96a1-2b0b0c8d9e6f-000000');
        expect(global.fetch).toHaveBeenCalledTimes(1);

        const call = (global.fetch as any).mock.calls[0];
        expect(call[0]).toBe('https://email.us-east-1.amazonaws.com/v2/email/outbound-emails');
        expect(call[1].method).toBe('POST');
        expect(call[1].headers.get('Content-Type')).toBe('application/json');
    });

    it('should format email addresses correctly', async () => {
        const mailer = createSESMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ MessageId: 'test-id' }),
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

        expect(payload.FromEmailAddress).toBe('Sender Name <sender@example.com>');
        expect(payload.Destination.ToAddresses).toEqual(['user1@example.com', 'User 2 <user2@example.com>']);
    });

    it('should handle CC and BCC addresses', async () => {
        const mailer = createSESMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ MessageId: 'test-id' }),
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

        expect(payload.Destination.CcAddresses).toEqual(['cc1@example.com', 'cc2@example.com']);
        expect(payload.Destination.BccAddresses).toEqual(['bcc@example.com']);
    });

    it('should handle text-only emails', async () => {
        const mailer = createSESMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ MessageId: 'test-id' }),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '', // html is required by the contract; empty means text-only
            text: 'Plain text body',
        });

        const call = (global.fetch as any).mock.calls[0];
        const payload = JSON.parse(call[1].body);

        expect(payload.Content.Simple.Body.Text).toBeDefined();
        expect(payload.Content.Simple.Body.Text.Data).toBe('Plain text body');
        expect(payload.Content.Simple.Body.Html).toBeUndefined();
    });

    it('should handle HTML and text emails', async () => {
        const mailer = createSESMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ MessageId: 'test-id' }),
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

        expect(payload.Content.Simple.Body.Html).toBeDefined();
        expect(payload.Content.Simple.Body.Html.Data).toBe('<p>HTML body</p>');
        expect(payload.Content.Simple.Body.Text).toBeDefined();
        expect(payload.Content.Simple.Body.Text.Data).toBe('Plain text body');
    });

    it('should handle reply-to addresses', async () => {
        const mailer = createSESMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ MessageId: 'test-id' }),
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

        expect(payload.ReplyToAddresses).toEqual(['Reply Name <reply@example.com>']);
    });

    it('should handle SES API errors', async () => {
        const mailer = createSESMailer(mockOptions);
        const mockResponse = {
            ok: false,
            status: 400,
            json: vi.fn().mockResolvedValue({
                __type: 'MessageRejected',
                message: 'Email address is not verified',
            }),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        const result = await mailer.send({
            from: 'unverified@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
        });

        expect(result.success).toBe(false);
        expect(result.provider).toBe('ses');
        expect(result.error).toContain('Email address is not verified');
        expect(result.raw).toBeDefined();
    });

    it('should handle network errors', async () => {
        const mailer = createSESMailer(mockOptions);

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
        const mailer = createSESMailer(mockOptions);
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
        expect(result.error).toContain('SES request failed (500)');
    });

    it('should include authorization headers with AWS signature', async () => {
        const mailer = createSESMailer(mockOptions);
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ MessageId: 'test-id' }),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
        });

        const call = (global.fetch as any).mock.calls[0];
        const headers = call[1].headers;

        expect(headers.get('Authorization')).toContain('AWS4-HMAC-SHA256');
        expect(headers.get('Authorization')).toContain('Credential=AKIAIOSFODNN7EXAMPLE');
        expect(headers.get('x-amz-date')).toBeDefined();
        expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('produces a SigV4 signature AWS accepts (raw-byte key chain, v2 REST path)', async () => {
        // Recompute SigV4 independently with node:crypto. The old code chained hex strings
        // between HMAC steps and signed path '/', so its signature could never match.
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'));
        try {
            (global.fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
            await createSESMailer(mockOptions).send({
                from: 'a@example.com',
                to: 'b@example.com',
                subject: 'S',
                html: 'T',
            });

            const [, init] = (global.fetch as any).mock.calls[0];
            const amzDate = '20260102T030405Z';
            const scope = '20260102/us-east-1/ses/aws4_request';
            const sha = (s: string) => createHash('sha256').update(s).digest('hex');
            const canonical = [
                'POST',
                '/v2/email/outbound-emails',
                '',
                `host:email.us-east-1.amazonaws.com\nx-amz-date:${amzDate}\n`,
                'host;x-amz-date',
                sha(init.body),
            ].join('\n');
            const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha(canonical)}`;
            const hmac = (key: Buffer | string, msg: string) => createHmac('sha256', key).update(msg).digest();
            let key = hmac(`AWS4${mockOptions.secretAccessKey}`, '20260102');
            for (const part of ['us-east-1', 'ses', 'aws4_request']) key = hmac(key, part);
            const expected = createHmac('sha256', key).update(stringToSign).digest('hex');

            expect(init.headers.get('x-amz-date')).toBe(amzDate);
            expect(init.headers.get('Authorization')).toContain(`Signature=${expected}`);
        } finally {
            vi.useRealTimers();
        }
    });

    it('sends custom headers as email headers, not EmailTags', async () => {
        (global.fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        await createSESMailer(mockOptions).send({
            from: 'a@example.com',
            to: 'b@example.com',
            subject: 'S',
            html: 'T',
            headers: { 'List-Unsubscribe': '<mailto:u@example.com>' },
        });
        const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
        expect(body.EmailTags).toBeUndefined();
        expect(body.Content.Simple.Headers).toEqual([{ Name: 'List-Unsubscribe', Value: '<mailto:u@example.com>' }]);
    });

    it('should use custom region when provided', async () => {
        const mailer = createSESMailer({
            ...mockOptions,
            region: 'eu-west-1',
        });
        const mockResponse = {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ MessageId: 'test-id' }),
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
        });

        const call = (global.fetch as any).mock.calls[0];
        expect(call[0]).toContain('email.eu-west-1.amazonaws.com');
    });
});
