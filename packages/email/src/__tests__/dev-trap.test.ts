import { describe, expect, it } from 'vitest';
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

        await new Promise((resolve) => setTimeout(resolve, 5));

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

        await new Promise((resolve) => setTimeout(resolve, 5));

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
});
