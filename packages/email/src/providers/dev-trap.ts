import type { EmailAddress, Mailer, SendEmailInput, SendEmailResult } from '../types';

export interface DevEmailTrapAddress {
    email: string;
    name?: string;
}

export interface DevEmailTrapMessage {
    id: string;
    provider: string;
    createdAt: number;
    from: DevEmailTrapAddress;
    to: DevEmailTrapAddress[];
    cc: DevEmailTrapAddress[];
    bcc: DevEmailTrapAddress[];
    replyTo?: DevEmailTrapAddress;
    subject: string;
    html: string;
    text?: string;
    headers?: Record<string, string>;
    tags?: string[];
    previewText: string;
}

export interface DevEmailTrapListResult {
    messages: DevEmailTrapMessage[];
    cursor?: string;
    hasMore: boolean;
}

export interface DevEmailTrapStore {
    storeMessage(message: DevEmailTrapMessage): Promise<void>;
    getMessage(id: string): Promise<DevEmailTrapMessage | null>;
    listMessages(options?: { limit?: number; cursor?: string }): Promise<DevEmailTrapListResult>;
    deleteMessage(id: string): Promise<boolean>;
    clearMessages(): Promise<number>;
}

export interface KVLike {
    put(
        key: string,
        value: string,
        options?: {
            expirationTtl?: number;
            metadata?: unknown;
        },
    ): Promise<void>;
    get<T = unknown>(key: string, type: 'json'): Promise<T | null>;
    delete(key: string): Promise<void>;
    list<Metadata = unknown>(options?: {
        prefix?: string;
        limit?: number;
        cursor?: string;
    }): Promise<{
        keys: Array<{
            name: string;
            metadata?: Metadata;
        }>;
        list_complete: boolean;
        cursor?: string;
    }>;
}

export interface KvDevEmailTrapStoreOptions {
    prefix?: string;
    maxEntries?: number;
    expirationTtl?: number;
}

export interface DevEmailTrapMailerOptions {
    /** Only `storeMessage` is required by the mailer; the full store is accepted too. */
    store: Pick<DevEmailTrapStore, 'storeMessage'>;
    providerName?: string;
}

const DEFAULT_PREFIX = 'dev-email-trap:';
const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_EXPIRATION_TTL = 7 * 24 * 60 * 60;

function normalizeAddress(address: EmailAddress): DevEmailTrapAddress {
    if (typeof address === 'string') {
        return { email: address };
    }

    return {
        email: address.email,
        ...(address.name ? { name: address.name } : {}),
    };
}

function normalizeAddressList(address?: EmailAddress | EmailAddress[]): DevEmailTrapAddress[] {
    if (!address) {
        return [];
    }

    if (Array.isArray(address)) {
        return address.map(normalizeAddress);
    }

    return [normalizeAddress(address)];
}

function stripHtml(html: string): string {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function createPreviewText(input: SendEmailInput): string {
    const source = input.text?.trim() || stripHtml(input.html);
    return source.length > 180 ? `${source.slice(0, 177)}...` : source;
}

async function listAllKeys(kv: KVLike, prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | undefined;

    do {
        const result = await kv.list({ prefix, limit: 1000, cursor });
        keys.push(...result.keys.map((entry) => entry.name));
        cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);

    return keys;
}

export function createKvEmailTrapStore(kv: KVLike, options: KvDevEmailTrapStoreOptions = {}): DevEmailTrapStore {
    const prefix = options.prefix ?? DEFAULT_PREFIX;
    const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    const expirationTtl = options.expirationTtl ?? DEFAULT_EXPIRATION_TTL;

    async function prune(): Promise<void> {
        const keys = await listAllKeys(kv, prefix);
        if (keys.length <= maxEntries) {
            return;
        }

        const messages = await Promise.all(
            keys.map(async (key) => {
                const value = await kv.get<DevEmailTrapMessage>(key, 'json');
                return value ? { key, createdAt: value.createdAt } : null;
            }),
        );

        const overflow = messages
            .filter((value): value is { key: string; createdAt: number } => value !== null)
            .sort((left, right) => right.createdAt - left.createdAt)
            .slice(maxEntries);

        await Promise.all(overflow.map((entry) => kv.delete(entry.key)));
    }

    return {
        async storeMessage(message: DevEmailTrapMessage): Promise<void> {
            await kv.put(`${prefix}${message.id}`, JSON.stringify(message), {
                expirationTtl,
                metadata: { createdAt: message.createdAt, subject: message.subject },
            });
            await prune();
        },

        async getMessage(id: string): Promise<DevEmailTrapMessage | null> {
            return kv.get<DevEmailTrapMessage>(`${prefix}${id}`, 'json');
        },

        async listMessages(options?: { limit?: number; cursor?: string }): Promise<DevEmailTrapListResult> {
            const limit = Math.max(1, Math.min(options?.limit ?? 25, 200));
            const offset = Math.max(0, Number(options?.cursor ?? '0') || 0);
            const keys = await listAllKeys(kv, prefix);
            const loaded = await Promise.all(keys.map((key) => kv.get<DevEmailTrapMessage>(key, 'json')));
            const messages = loaded
                .filter((value): value is DevEmailTrapMessage => value !== null)
                .sort((left, right) => right.createdAt - left.createdAt);
            const page = messages.slice(offset, offset + limit);
            const nextOffset = offset + page.length;

            return {
                messages: page,
                hasMore: nextOffset < messages.length,
                cursor: nextOffset < messages.length ? String(nextOffset) : undefined,
            };
        },

        async deleteMessage(id: string): Promise<boolean> {
            await kv.delete(`${prefix}${id}`);
            return true;
        },

        async clearMessages(): Promise<number> {
            const keys = await listAllKeys(kv, prefix);
            await Promise.all(keys.map((key) => kv.delete(key)));
            return keys.length;
        },
    };
}

export function createDevEmailTrapMailer(options: DevEmailTrapMailerOptions): Mailer {
    const provider = options.providerName ?? 'dev-trap';

    return {
        provider,
        async send(input: SendEmailInput): Promise<SendEmailResult> {
            try {
                const message: DevEmailTrapMessage = {
                    id: crypto.randomUUID(),
                    provider,
                    createdAt: Date.now(),
                    from: normalizeAddress(input.from),
                    to: normalizeAddressList(input.to),
                    cc: normalizeAddressList(input.cc),
                    bcc: normalizeAddressList(input.bcc),
                    ...(input.replyTo ? { replyTo: normalizeAddress(input.replyTo) } : {}),
                    subject: input.subject,
                    html: input.html,
                    ...(input.text ? { text: input.text } : {}),
                    ...(input.headers ? { headers: input.headers } : {}),
                    ...(input.tags ? { tags: input.tags } : {}),
                    previewText: createPreviewText(input),
                };

                await options.store.storeMessage(message);

                return {
                    provider,
                    success: true,
                    id: message.id,
                    raw: message,
                };
            } catch (error) {
                return {
                    provider,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        },
    };
}
