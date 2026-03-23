import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDevEmailTrapMailer, createKvEmailTrapStore, type KVLike } from '../providers/dev-trap';

class MemoryKv implements KVLike {
    private readonly values = new Map<string, string>();

    async put(key: string, value: string): Promise<void> {
        this.values.set(key, value);
    }

    async get<T = unknown>(key: string, type: 'json'): Promise<T | null> {
        const value = this.values.get(key);
        if (!value) {
            return null;
        }

        return (type === 'json' ? JSON.parse(value) : value) as T;
    }

    async delete(key: string): Promise<void> {
        this.values.delete(key);
    }

    async list(options?: { prefix?: string; limit?: number; cursor?: string }) {
        const prefix = options?.prefix ?? '';
        const limit = options?.limit ?? 1000;
        const offset = Number(options?.cursor ?? '0') || 0;
        const keys = Array.from(this.values.keys())
            .filter((key) => key.startsWith(prefix))
            .sort();
        const page = keys.slice(offset, offset + limit).map((name) => ({ name }));
        const next = offset + page.length;

        return {
            keys: page,
            list_complete: next >= keys.length,
            cursor: next < keys.length ? String(next) : undefined,
        };
    }
}

describe('dev email trap provider', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('captures messages and lists them newest first', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });
        const mailer = createDevEmailTrapMailer({ store });

        await mailer.send({
            from: 'sender@example.com',
            to: 'first@example.com',
            subject: 'First',
            html: '<p>First email</p>',
        });

        vi.advanceTimersByTime(100);

        await mailer.send({
            from: 'sender@example.com',
            to: 'second@example.com',
            subject: 'Second',
            html: '<p>Second email</p>',
        });

        const result = await store.listMessages({ limit: 10 });

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].subject).toBe('Second');
        expect(result.messages[1].subject).toBe('First');
        expect(result.messages[0].previewText).toContain('Second email');
    });

    it('prunes old entries when maxEntries is exceeded', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 1 });
        const mailer = createDevEmailTrapMailer({ store });

        const first = await mailer.send({
            from: 'sender@example.com',
            to: 'first@example.com',
            subject: 'First',
            html: '<p>First email</p>',
        });

        vi.advanceTimersByTime(100);

        await mailer.send({
            from: 'sender@example.com',
            to: 'second@example.com',
            subject: 'Second',
            html: '<p>Second email</p>',
        });

        const result = await store.listMessages({ limit: 10 });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].subject).toBe('Second');
        expect(await store.getMessage(first.id || '')).toBeNull();
    });

    it('getMessage returns a single message by id', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });
        const mailer = createDevEmailTrapMailer({ store });

        const result = await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Hello</p>',
        });

        const message = await store.getMessage(result.id || '');
        expect(message).not.toBeNull();
        expect(message!.subject).toBe('Test');
        expect(message!.to[0].email).toBe('user@example.com');
    });

    it('getMessage returns null for unknown id', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });

        const message = await store.getMessage('non-existent-id');
        expect(message).toBeNull();
    });

    it('deleteMessage removes a single message', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });
        const mailer = createDevEmailTrapMailer({ store });

        const result = await mailer.send({
            from: 'sender@example.com',
            to: 'user@example.com',
            subject: 'To delete',
            html: '<p>Delete me</p>',
        });

        const deleted = await store.deleteMessage(result.id || '');
        expect(deleted).toBe(true);
        expect(await store.getMessage(result.id || '')).toBeNull();
    });

    it('clearMessages removes all messages and returns count', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });
        const mailer = createDevEmailTrapMailer({ store });

        await mailer.send({ from: 'a@b.com', to: 'x@y.com', subject: 'One', html: '<p>1</p>' });
        await mailer.send({ from: 'a@b.com', to: 'x@y.com', subject: 'Two', html: '<p>2</p>' });
        await mailer.send({ from: 'a@b.com', to: 'x@y.com', subject: 'Three', html: '<p>3</p>' });

        const cleared = await store.clearMessages();
        expect(cleared).toBe(3);

        const result = await store.listMessages();
        expect(result.messages).toHaveLength(0);
    });

    it('listMessages paginates with cursor', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });
        const mailer = createDevEmailTrapMailer({ store });

        for (let i = 0; i < 5; i++) {
            await mailer.send({
                from: 'a@b.com',
                to: 'x@y.com',
                subject: `Msg ${i}`,
                html: `<p>${i}</p>`,
            });
            vi.advanceTimersByTime(100);
        }

        const page1 = await store.listMessages({ limit: 2 });
        expect(page1.messages).toHaveLength(2);
        expect(page1.hasMore).toBe(true);
        expect(page1.cursor).toBeDefined();

        const page2 = await store.listMessages({ limit: 2, cursor: page1.cursor });
        expect(page2.messages).toHaveLength(2);
        expect(page2.hasMore).toBe(true);

        const page3 = await store.listMessages({ limit: 2, cursor: page2.cursor });
        expect(page3.messages).toHaveLength(1);
        expect(page3.hasMore).toBe(false);
        expect(page3.cursor).toBeUndefined();
    });

    it('normalizes string and object email addresses', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });
        const mailer = createDevEmailTrapMailer({ store });

        const result = await mailer.send({
            from: { email: 'sender@example.com', name: 'Sender Name' },
            to: ['plain@example.com', { email: 'named@example.com', name: 'Named Recipient' }],
            cc: 'cc@example.com',
            bcc: { email: 'bcc@example.com' },
            replyTo: { email: 'reply@example.com', name: 'Reply' },
            subject: 'Addresses',
            html: '<p>Test</p>',
        });

        const message = await store.getMessage(result.id || '');
        expect(message).not.toBeNull();
        expect(message!.from).toEqual({ email: 'sender@example.com', name: 'Sender Name' });
        expect(message!.to).toHaveLength(2);
        expect(message!.to[0]).toEqual({ email: 'plain@example.com' });
        expect(message!.to[1]).toEqual({ email: 'named@example.com', name: 'Named Recipient' });
        expect(message!.cc).toHaveLength(1);
        expect(message!.cc[0]).toEqual({ email: 'cc@example.com' });
        expect(message!.bcc).toHaveLength(1);
        expect(message!.bcc[0]).toEqual({ email: 'bcc@example.com' });
        expect(message!.replyTo).toEqual({ email: 'reply@example.com', name: 'Reply' });
    });

    it('generates preview text from plain text when available', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });
        const mailer = createDevEmailTrapMailer({ store });

        const result = await mailer.send({
            from: 'a@b.com',
            to: 'x@y.com',
            subject: 'Preview',
            html: '<p>HTML content</p>',
            text: 'Plain text content',
        });

        const message = await store.getMessage(result.id || '');
        expect(message!.previewText).toBe('Plain text content');
    });

    it('generates preview text from HTML when no plain text', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });
        const mailer = createDevEmailTrapMailer({ store });

        const result = await mailer.send({
            from: 'a@b.com',
            to: 'x@y.com',
            subject: 'Preview',
            html: '<h1>Title</h1><p>Body content here</p>',
        });

        const message = await store.getMessage(result.id || '');
        expect(message!.previewText).toContain('Title');
        expect(message!.previewText).toContain('Body content here');
    });

    it('truncates long preview text to 180 characters', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });
        const mailer = createDevEmailTrapMailer({ store });

        const longText = 'A'.repeat(300);
        const result = await mailer.send({
            from: 'a@b.com',
            to: 'x@y.com',
            subject: 'Long',
            html: `<p>${longText}</p>`,
        });

        const message = await store.getMessage(result.id || '');
        expect(message!.previewText).toHaveLength(180);
        expect(message!.previewText).toMatch(/\.\.\.$/);
    });

    it('captures optional fields: headers and tags', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });
        const mailer = createDevEmailTrapMailer({ store });

        const result = await mailer.send({
            from: 'a@b.com',
            to: 'x@y.com',
            subject: 'Headers',
            html: '<p>Test</p>',
            headers: { 'X-Custom': 'value' },
            tags: ['tag1', 'tag2'],
        });

        const message = await store.getMessage(result.id || '');
        expect(message!.headers).toEqual({ 'X-Custom': 'value' });
        expect(message!.tags).toEqual(['tag1', 'tag2']);
    });

    it('returns success result with id and raw message', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });
        const mailer = createDevEmailTrapMailer({ store });

        const result = await mailer.send({
            from: 'a@b.com',
            to: 'x@y.com',
            subject: 'Result',
            html: '<p>Test</p>',
        });

        expect(result.success).toBe(true);
        expect(result.provider).toBe('dev-trap');
        expect(result.id).toBeDefined();
        expect(result.raw).toBeDefined();
    });

    it('uses custom provider name', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });
        const mailer = createDevEmailTrapMailer({ store, providerName: 'custom-trap' });

        const result = await mailer.send({
            from: 'a@b.com',
            to: 'x@y.com',
            subject: 'Custom',
            html: '<p>Test</p>',
        });

        expect(result.provider).toBe('custom-trap');
        const message = await store.getMessage(result.id || '');
        expect(message!.provider).toBe('custom-trap');
    });

    it('uses custom prefix for KV keys', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { prefix: 'custom:' });
        const mailer = createDevEmailTrapMailer({ store });

        await mailer.send({
            from: 'a@b.com',
            to: 'x@y.com',
            subject: 'Custom prefix',
            html: '<p>Test</p>',
        });

        const result = await store.listMessages();
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].subject).toBe('Custom prefix');
    });

    it('handles empty inbox gracefully', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });

        const result = await store.listMessages();
        expect(result.messages).toHaveLength(0);
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeUndefined();

        const cleared = await store.clearMessages();
        expect(cleared).toBe(0);
    });

    it('strips script and style tags from HTML preview', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });
        const mailer = createDevEmailTrapMailer({ store });

        const result = await mailer.send({
            from: 'a@b.com',
            to: 'x@y.com',
            subject: 'Script strip',
            html: '<style>body{color:red}</style><script>alert("x")</script><p>Visible text</p>',
        });

        const message = await store.getMessage(result.id || '');
        expect(message!.previewText).toBe('Visible text');
        expect(message!.previewText).not.toContain('alert');
        expect(message!.previewText).not.toContain('color');
    });

    it('omits optional fields when not provided', async () => {
        const kv = new MemoryKv();
        const store = createKvEmailTrapStore(kv, { maxEntries: 10 });
        const mailer = createDevEmailTrapMailer({ store });

        const result = await mailer.send({
            from: 'a@b.com',
            to: 'x@y.com',
            subject: 'Minimal',
            html: '<p>Min</p>',
        });

        const message = await store.getMessage(result.id || '');
        expect(message!.text).toBeUndefined();
        expect(message!.headers).toBeUndefined();
        expect(message!.tags).toBeUndefined();
        expect(message!.replyTo).toBeUndefined();
        expect(message!.cc).toEqual([]);
        expect(message!.bcc).toEqual([]);
    });
});
