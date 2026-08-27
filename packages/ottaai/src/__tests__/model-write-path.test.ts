// ============================================================
// The WRITE PATH, exercised through the real model statics.
//
// The design's mandatory assertion is "create a credential at each scope rung
// THROUGH THE REAL WRITE PATH": unit tests over the pure scorer pass regardless
// of whether the write path can actually produce a row that lands on that rung,
// and the symptom of a rung the write path cannot produce is ALWAYS an empty
// result with no error, which sends people to debug the wrong layer.
//
// A stub Drizzle driver stands in for D1 so these run with no database. It is
// deliberately thin: it records what the model tried to persist, which is
// exactly what the four secret rules and the tenancy rules are about.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { clearConnection, registerConnection } from '@ottabase/ottaorm';
import { decryptSecret, createDefaultDecryptorRegistry, isEnvelope } from '../crypto';
import { AI_ERROR_CODES, AiProvisioningError } from '../errors';
import { createProviderRegistry } from '../registry';
import { KEY_HINT_MASK } from '../secret';
import {
    AiProviderCredential,
    configureCredentialWrites,
    resetCredentialWrites,
} from '../ottaorm/AiProviderCredential';
import { createTestKeyring } from '../testing';

// ---------------------------------------------------------------------------
// A stub driver: enough Drizzle surface for insert / update / select-first.
// ---------------------------------------------------------------------------

interface Recorded {
    inserts: Array<Record<string, unknown>>;
    updates: Array<Record<string, unknown>>;
    selects: number;
}

function createStubDriver(rows: Array<Record<string, unknown>>, recorded: Recorded) {
    const db = {
        insert() {
            return {
                values(data: Record<string, unknown>) {
                    recorded.inserts.push(data);
                    rows.push({ ...data });
                    return { returning: async () => [{ ...data }] };
                },
            };
        },
        update() {
            return {
                set(data: Record<string, unknown>) {
                    recorded.updates.push(data);
                    return {
                        where() {
                            const merged = { ...(rows[0] ?? {}), ...data };
                            rows[0] = merged;
                            return {
                                returning: async () => [merged],
                                // `update` without `.returning()` (the sibling-deactivation path)
                                then: (resolve: (value: unknown) => unknown) => resolve([merged]),
                            };
                        },
                    };
                },
            };
        },
        select() {
            recorded.selects += 1;
            return {
                from() {
                    const result = {
                        where: () => result,
                        orderBy: () => result,
                        offset: () => result,
                        limit: async () => rows.slice(0, 1),
                        then: (resolve: (value: unknown) => unknown) => resolve(rows),
                    };
                    return result;
                },
            };
        },
        delete() {
            return { where: async () => undefined };
        },
    };

    return {
        getDb: () => db,
        execute: async () => [],
        executeRaw: async () => undefined,
    };
}

/**
 * The built-ins plus ONE keyless, tenant-selectable provider.
 *
 * The keyless case used to be exercised with `workers-ai`, which is now
 * `tenantSelectable: false` — it is billed to the operator, has no tenant key to bring, and
 * is not reachable through the gateway's provider-native shape. Testing the RULE ("a keyless
 * provider may be saved with no secret") against an `extend`-ed provider is the better test
 * anyway: it stops depending on which built-in happens to carry which flags.
 */
const registry = createProviderRegistry({
    extend: [{ id: 'keyless-test', displayName: 'Keyless (test)', requiresKey: false }],
});
let rows: Array<Record<string, unknown>>;
let recorded: Recorded;

beforeEach(() => {
    rows = [];
    recorded = { inserts: [], updates: [], selects: 0 };
    clearConnection('default');
    registerConnection('default', createStubDriver(rows, recorded) as never);
    resetCredentialWrites();
    configureCredentialWrites({ keyring: createTestKeyring(), registry });
});

const BASE = {
    provider: 'openai',
    label: 'Work',
    secret: 'sk-abcdefgh12345678',
    userId: 'user-1',
    organizationId: null as string | null,
    appId: 'app-1',
};

describe('a write path with no keyring must never store plaintext', () => {
    it('throws rather than falling back when configureCredentialWrites was never called', async () => {
        resetCredentialWrites();
        await expect(AiProviderCredential.create({ ...BASE })).rejects.toMatchObject({
            code: AI_ERROR_CODES.NO_ENCRYPTION_KEY,
        });
    });
});

describe('create — every scope rung the strategy can score must be producible', () => {
    it('produces a USER-scoped row', async () => {
        await AiProviderCredential.create({ ...BASE });
        expect(recorded.inserts[0]).toMatchObject({ userId: 'user-1', organizationId: null, appId: 'app-1' });
    });

    it('produces an ORG-scoped row', async () => {
        await AiProviderCredential.create({ ...BASE, userId: null, organizationId: 'org-a' });
        expect(recorded.inserts[0]).toMatchObject({ userId: null, organizationId: 'org-a' });
    });

    it('produces a USER+ORG row', async () => {
        await AiProviderCredential.create({ ...BASE, userId: 'user-1', organizationId: 'org-a' });
        expect(recorded.inserts[0]).toMatchObject({ userId: 'user-1', organizationId: 'org-a' });
    });

    it('REFUSES an unscoped row — there is no such thing as a global credential', async () => {
        await expect(
            AiProviderCredential.create({ ...BASE, userId: null, organizationId: null }),
        ).rejects.toMatchObject({ code: AI_ERROR_CODES.VALIDATION });
    });
});

describe('create — the secret rules', () => {
    it('stores an ENVELOPE, never the plaintext, and derives the hint from the same trimmed string', async () => {
        await AiProviderCredential.create({ ...BASE, secret: '  sk-abcdefgh12345678\n' });
        const row = recorded.inserts[0]!;

        expect(row.secretKind).toBe('inline');
        expect(isEnvelope(String(row.secretCiphertext))).toBe(true);
        expect(JSON.stringify(row)).not.toContain('sk-abcdefgh12345678');
        // Trimmed once: the hint's last four match what was actually stored, not the newline.
        expect(row.keyHint).toBe(`${KEY_HINT_MASK}5678`);
        expect(row.keyId).toBe('test');
        expect(row.formatVersion).toBe('v1');
        // The non-column field never reaches the insert.
        expect(row).not.toHaveProperty('secret');
    });

    it('binds the ciphertext to the row id that is ACTUALLY inserted', async () => {
        // If the model generated one id for the AAD and the ORM generated another for the
        // row, every subsequent decrypt would fail with DECRYPT_FAILED and look like a
        // botched rotation.
        await AiProviderCredential.create({ ...BASE });
        const row = recorded.inserts[0]!;

        const plain = await decryptSecret({
            envelope: String(row.secretCiphertext),
            keyring: createTestKeyring(),
            registry: createDefaultDecryptorRegistry(),
            aad: {
                credentialId: String(row.id),
                organizationId: (row.organizationId as string | null) ?? null,
                userId: (row.userId as string | null) ?? null,
                appId: (row.appId as string | null) ?? null,
                provider: String(row.provider),
            },
        });
        expect(plain.expose()).toBe(BASE.secret);
    });

    it('rejects a pre-encrypted value on CREATE — it would skip hint derivation forever', async () => {
        await AiProviderCredential.create({ ...BASE });
        const envelope = String(recorded.inserts[0]!.secretCiphertext);
        rows.length = 0;
        recorded.inserts.length = 0;

        await expect(AiProviderCredential.create({ ...BASE, secret: envelope })).rejects.toMatchObject({
            code: AI_ERROR_CODES.VALIDATION,
        });
    });

    it('requires a key for a provider that needs one, and allows none for a keyless provider', async () => {
        await expect(AiProviderCredential.create({ ...BASE, secret: '   ' })).rejects.toMatchObject({
            code: AI_ERROR_CODES.VALIDATION,
        });

        await AiProviderCredential.create({ ...BASE, provider: 'keyless-test', secret: '' });
        expect(recorded.inserts[0]).toMatchObject({ secretKind: 'none', keyHint: '' });
    });

    it('REFUSES a provider that is not registered at all', async () => {
        // Without this the row writes, lists and edits perfectly well, and then resolves to
        // `PROVIDER_UNREGISTERED` forever with nothing for the tenant to act on.
        await expect(AiProviderCredential.create({ ...BASE, provider: 'totally-made-up' })).rejects.toMatchObject({
            code: AI_ERROR_CODES.VALIDATION,
        });
    });

    it('REFUSES a registered but platform-only provider', async () => {
        // `workers-ai` is billed to the operator and has no tenant key to bring, so a tenant
        // row for it can never satisfy a `required` gate — and the gateway transport cannot
        // call it through the provider-native shape either.
        await expect(
            AiProviderCredential.create({ ...BASE, provider: 'workers-ai', secret: '' }),
        ).rejects.toMatchObject({ code: AI_ERROR_CODES.VALIDATION });
    });

    it('REFUSES a model whose provider head disagrees with the credential provider', async () => {
        // It used to be a warning. The transport picks the URL from the model and the auth
        // header from the credential, so the pairing is a request routed to one provider
        // carrying another provider's key.
        await expect(
            AiProviderCredential.create({ ...BASE, model: 'anthropic/claude-sonnet-4-5' }),
        ).rejects.toMatchObject({ code: AI_ERROR_CODES.VALIDATION });

        // A matching head and a bare id both stay legal.
        await AiProviderCredential.create({ ...BASE, model: 'openai/gpt-4o' });
        expect(recorded.inserts[0]).toMatchObject({ model: 'openai/gpt-4o' });
    });

    it('rejects a gateway alias when no validator is configured', async () => {
        await expect(
            AiProviderCredential.create({ ...BASE, secret: undefined, alias: 'org-shared-key' }),
        ).rejects.toMatchObject({ code: AI_ERROR_CODES.VALIDATION });
    });

    it('accepts a validated alias and never lets it reach the DB as an unknown column', async () => {
        resetCredentialWrites();
        configureCredentialWrites({
            keyring: createTestKeyring(),
            registry,
            validateAlias: ({ alias }) => alias === 'org-shared-key',
        });

        await AiProviderCredential.create({ ...BASE, secret: undefined, alias: 'org-shared-key' });
        const row = recorded.inserts[0]!;
        expect(row).toMatchObject({ secretKind: 'alias', secretAlias: 'org-shared-key', secretCiphertext: null });
        expect(row).not.toHaveProperty('alias');
        // An alias reveals nothing — the hint is the bare mask.
        expect(row.keyHint).toBe(KEY_HINT_MASK);
    });

    it('rejects an alias the validator does not recognise — an unvalidated alias is a cross-tenant key-use primitive', async () => {
        resetCredentialWrites();
        configureCredentialWrites({
            keyring: createTestKeyring(),
            registry,
            validateAlias: () => false,
        });
        await expect(
            AiProviderCredential.create({ ...BASE, secret: undefined, alias: 'someone-elses-key' }),
        ).rejects.toMatchObject({ code: AI_ERROR_CODES.VALIDATION });
    });
});

describe('create — operator-only inputs are refused', () => {
    it('rejects a dynamic/<route> model reference from a tenant write', async () => {
        await expect(AiProviderCredential.create({ ...BASE, model: 'dynamic/premium-route' })).rejects.toMatchObject({
            code: AI_ERROR_CODES.VALIDATION,
        });
    });

    it('rejects a destination-bearing transport option', async () => {
        await expect(
            AiProviderCredential.create({ ...BASE, transportConfig: { baseUrl: 'https://attacker.example' } }),
        ).rejects.toThrow(/operator-only/);
    });

    it('strips server-owned fields a client tried to forge', async () => {
        await AiProviderCredential.create({
            ...BASE,
            keyHint: '••••0000',
            secretKind: 'none',
            consecutiveFailures: 99,
        });
        const row = recorded.inserts[0]!;
        expect(row.keyHint).toBe(`${KEY_HINT_MASK}5678`);
        expect(row.secretKind).toBe('inline');
        expect(row.consecutiveFailures).toBeUndefined();
    });
});

describe('update', () => {
    async function seed(overrides: Record<string, unknown> = {}) {
        await AiProviderCredential.create({ ...BASE, ...overrides });
        const created = recorded.inserts[0]!;
        recorded.inserts.length = 0;
        recorded.updates.length = 0;
        recorded.selects = 0;
        return created;
    }

    it('BLANK MEANS KEEP — never overwrites a stored key with an empty string', async () => {
        const created = await seed();
        await AiProviderCredential.update(String(created.id), { label: 'Renamed', secret: '' });

        const patch = recorded.updates[0]!;
        expect(patch.label).toBe('Renamed');
        expect(patch).not.toHaveProperty('secretCiphertext');
        expect(patch).not.toHaveProperty('keyHint');
    });

    it('clearing is an EXPLICIT transition that nulls the columns AND the hint together', async () => {
        const created = await seed({ provider: 'keyless-test' });
        await AiProviderCredential.update(String(created.id), { clearSecret: true });

        expect(recorded.updates[0]).toMatchObject({
            secretKind: 'none',
            secretCiphertext: null,
            secretAlias: null,
            keyHint: '',
        });
        expect(recorded.updates[0]).not.toHaveProperty('clearSecret');
    });

    it('refuses a provider change that would leave the OLD provider key under the NEW provider', async () => {
        const created = await seed();
        await expect(AiProviderCredential.update(String(created.id), { provider: 'anthropic' })).rejects.toMatchObject({
            code: AI_ERROR_CODES.VALIDATION,
        });

        // …and allows it when the key is re-entered.
        await AiProviderCredential.update(String(created.id), {
            provider: 'anthropic',
            secret: 'sk-ant-zyxwvutsrqponml',
        });
        expect(recorded.updates.at(-1)).toMatchObject({ provider: 'anthropic', secretKind: 'inline' });
    });

    it('refuses a provider change that would retain a model routed to the old provider', async () => {
        const created = await seed({ model: 'openai/gpt-4o' });

        await expect(
            AiProviderCredential.update(String(created.id), {
                provider: 'anthropic',
                secret: 'sk-ant-zyxwvutsrqponml',
            }),
        ).rejects.toMatchObject({ code: AI_ERROR_CODES.VALIDATION });

        await AiProviderCredential.update(String(created.id), {
            provider: 'anthropic',
            model: 'anthropic/claude-sonnet-4-5',
            secret: 'sk-ant-zyxwvutsrqponml',
        });
        expect(recorded.updates.at(-1)).toMatchObject({
            provider: 'anthropic',
            model: 'anthropic/claude-sonnet-4-5',
        });
    });

    it('TENANCY IS IMMUTABLE — rejected inside the model, where no RLS contextFields can re-enable it', async () => {
        const created = await seed();
        await AiProviderCredential.update(String(created.id), {
            label: 'Renamed',
            organizationId: 'org-attacker',
            userId: 'user-attacker',
            appId: 'other-app',
        });

        const patch = recorded.updates[0]!;
        expect(patch).not.toHaveProperty('organizationId');
        expect(patch).not.toHaveProperty('userId');
        expect(patch).not.toHaveProperty('appId');
    });

    it('`isActive` has no direct write path — activation is one dedicated mutation', async () => {
        const created = await seed();
        await AiProviderCredential.update(String(created.id), { label: 'x', isActive: false });
        expect(recorded.updates[0]).not.toHaveProperty('isActive');
    });

    it('passes an already-encrypted value through BYTE-IDENTICAL on update', async () => {
        const created = await seed();
        const envelope = String(created.secretCiphertext);
        await AiProviderCredential.update(String(created.id), { secret: envelope });
        // Without this, an internal re-save would wrap ciphertext in ciphertext and the next
        // decrypt would return the inner envelope string as the "API key".
        expect(recorded.updates[0]!.secretCiphertext).toBe(envelope);
    });

    it('uses the RLS-authorized snapshot in constrained CRUD without an unscoped re-read', async () => {
        const created = await seed();

        await AiProviderCredential.updateConstrained(
            String(created.id),
            { label: 'Authorized rename', secret: '' },
            {
                where: { userId: created.userId, organizationId: created.organizationId, appId: created.appId },
                expected: { updatedAt: created.updatedAt },
            },
            created,
        );

        expect(recorded.selects).toBe(0);
        expect(recorded.updates[0]).toMatchObject({ label: 'Authorized rename' });
        expect(recorded.updates[0]).not.toHaveProperty('secretCiphertext');
        expect(recorded.updates[0]).not.toHaveProperty('organizationId');
        expect(recorded.updates[0]).not.toHaveProperty('userId');
        expect(recorded.updates[0]).not.toHaveProperty('appId');
    });
});

describe('configureCredentialWrites refuses a conflicting keyring in one isolate', () => {
    it('throws rather than letting one request wrap with another request key', () => {
        expect(() =>
            configureCredentialWrites({
                keyring: createTestKeyring(
                    { other: 'YW5vdGhlci1tYXN0ZXItc2VjcmV0LWZvci1vdHRhYWktMzJieXRlcy1taW4' },
                    'other',
                ),
                registry,
            }),
        ).toThrow(AiProvisioningError);
    });
});
