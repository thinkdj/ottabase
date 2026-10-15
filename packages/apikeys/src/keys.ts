import { errorResponse } from '@ottabase/utils/http-errors';
import { ApiKey } from './ottaorm-models/ApiKey';
import type { ApiKeys, ApiKeysOptions, ApiKeyView, Scope, Subject } from './types';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const SECRET_LENGTH = 40;
const PREFIX_VISIBLE = 8;

export async function sha256Hex(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomBytes(bytes: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(bytes));
}

/** Base62 from random bytes, with rejection sampling so no character is favoured. */
export function randomSecret(length: number, random: (bytes: number) => Uint8Array = randomBytes): string {
    let out = '';
    while (out.length < length) {
        for (const byte of random(length * 2)) {
            // 248 = 4 × 62: bytes at or above it would bias the first few letters.
            if (byte < 248) out += ALPHABET[byte % ALPHABET.length];
            if (out.length === length) break;
        }
    }
    return out;
}

function scopeColumns(subject: Subject): { organizationId: string; userId: string } {
    return { organizationId: subject.organizationId ?? '', userId: subject.userId ?? '' };
}

function isLive(key: ApiKeyView, now: number): 'REVOKED' | 'EXPIRED' | null {
    if (key.revokedAt !== null) return 'REVOKED';
    if (key.expiresAt !== null && key.expiresAt <= now) return 'EXPIRED';
    return null;
}

function hasScopes(key: ApiKeyView, required: Scope[] | undefined): boolean {
    if (!required?.length) return true;
    return required.every((scope) => key.scopes.includes(scope) || key.scopes.includes('*'));
}

/**
 * Build the app's API key service. One per app, in its package composition:
 *
 * ```typescript
 * export const apiKeys = createApiKeys<CloudflareEnv>({ prefix: 'ok_live_', afterVerify: (env, key, req) => rateLimit(env, key.id, req) });
 * ```
 */
export function createApiKeys<Env = unknown>(options: ApiKeysOptions<Env> = {}): ApiKeys<Env> {
    const prefix = options.prefix ?? 'ok_live_';
    const now = options.now ?? Date.now;
    const random = options.random ?? randomBytes;
    const touchInterval = options.touchIntervalMs ?? 60_000;
    const maxKeys = options.maxKeysPerSubject ?? 25;
    const tokenShape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[A-Za-z0-9]{${SECRET_LENGTH}}$`);

    function readToken(request: Request): string | null {
        const authorization = request.headers.get('authorization');
        if (authorization) {
            const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
            if (match) return match[1].trim();
        }
        return request.headers.get('x-api-key')?.trim() || null;
    }

    async function touch(row: ApiKey, at: number): Promise<void> {
        const last = row.toView().lastUsedAt;
        if (last !== null && at - last < touchInterval) return;
        try {
            await ApiKey.update(String(row.get('id')), { lastUsedAt: at });
        } catch {
            /* last-used is a convenience; a failed write must not fail the request */
        }
    }

    const service: ApiKeys<Env> = {
        async issue(_env, subject, input) {
            if (!subject.appId || (!subject.organizationId && !subject.userId)) {
                throw new Error('[apikeys] a key needs an organization or a user to belong to');
            }
            const name = input.name?.trim();
            if (!name || name.length > 80) throw new Error('[apikeys] name is required (at most 80 characters)');
            const scopes = [...new Set((input.scopes ?? []).map((scope) => scope.trim()).filter(Boolean))];
            if (scopes.some((scope) => scope.length > 64 || !/^[a-z0-9*][a-z0-9:._*-]*$/i.test(scope))) {
                throw new Error('[apikeys] a scope is a short token like "read" or "events:ingest"');
            }
            const existing = (await ApiKey.where({
                appId: subject.appId,
                ...scopeColumns(subject),
                revokedAt: null,
            })) as ApiKey[];
            if (existing.length >= maxKeys) throw new Error(`[apikeys] at most ${maxKeys} active keys per subject`);

            const key = `${prefix}${randomSecret(SECRET_LENGTH, random)}`;
            const row = (await ApiKey.create({
                appId: subject.appId,
                ...scopeColumns(subject),
                name,
                prefix: key.slice(0, prefix.length + PREFIX_VISIBLE),
                hash: await sha256Hex(key),
                scopes,
                createdBy: subject.userId,
                expiresAt: input.expiresAt ?? null,
            })) as ApiKey;
            return { key, record: row.toView() };
        },

        async list(_env, subject) {
            const rows = (await ApiKey.where(
                { appId: subject.appId, ...scopeColumns(subject) },
                { orderBy: 'createdAt', orderDirection: 'desc', limit: 200 },
            )) as ApiKey[];
            return rows.map((row) => row.toView());
        },

        async revoke(_env, subject, id) {
            const row = (await ApiKey.first({ id, appId: subject.appId, ...scopeColumns(subject) })) as ApiKey | null;
            if (!row) return null;
            if (row.toView().revokedAt === null) await ApiKey.update(id, { revokedAt: now() });
            return ((await ApiKey.first({ id })) as ApiKey).toView();
        },

        async verify(_env, token, verifyOptions = {}) {
            if (!token) return { ok: false, reason: 'MISSING' };
            if (!tokenShape.test(token)) return { ok: false, reason: 'MALFORMED' };
            const row = (await ApiKey.first({ hash: await sha256Hex(token) })) as ApiKey | null;
            if (!row) return { ok: false, reason: 'NOT_FOUND' };
            const key = row.toView();
            const at = now();
            const dead = isLive(key, at);
            if (dead) return { ok: false, reason: dead, key };
            if (!hasScopes(key, verifyOptions.scopes)) return { ok: false, reason: 'SCOPE', key };
            await touch(row, at);
            return {
                ok: true,
                key,
                subject: { appId: String(row.get('appId')), organizationId: key.organizationId, userId: key.userId },
            };
        },

        async authenticate(request, env, authOptions = {}) {
            const result = await service.verify(env, readToken(request), authOptions);
            if (!result.ok) {
                if (result.reason === 'SCOPE') {
                    return errorResponse('This API key does not have the required scope', 403, {
                        code: 'FORBIDDEN',
                        metadata: { required: authOptions.scopes ?? [] },
                    });
                }
                const messages = {
                    MISSING: 'An API key is required (Authorization: Bearer <key>)',
                    MALFORMED: 'The API key is not well formed',
                    NOT_FOUND: 'The API key is not valid',
                    REVOKED: 'The API key has been revoked',
                    EXPIRED: 'The API key has expired',
                } as const;
                return errorResponse(messages[result.reason], 401, {
                    code: 'UNAUTHORIZED',
                    metadata: { reason: result.reason },
                });
            }
            const refused = await options.afterVerify?.(env, result.key, request);
            return refused ?? result;
        },

        readToken,
    };
    return service;
}
