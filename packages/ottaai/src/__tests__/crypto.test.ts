import { describe, expect, it } from 'vitest';
import {
    buildAad,
    createDefaultDecryptorRegistry,
    createKeyring,
    decryptSecret,
    encryptSecret,
    formatEnvelope,
    isEnvelope,
    parseEnvelopeOrNull,
    rotationState,
} from '../crypto';
import { AI_ERROR_CODES, AiProvisioningError } from '../errors';
import { deriveKeyHint, KEY_HINT_MASK, normalizeSubmittedSecret, redactSecrets, SecretValue } from '../secret';
import { createTestKeyring, TEST_MASTER_SECRET } from '../testing';

const AAD = {
    credentialId: 'cred-1',
    organizationId: 'org-a',
    userId: 'user-1',
    appId: 'app-1',
    provider: 'openai',
};

describe('keyring', () => {
    it('rejects a master secret below the minimum entropy — the premise of choosing HKDF is enforced', () => {
        expect(() => createKeyring({ keys: { k1: 'my-project-name' }, currentKeyId: 'k1' })).toThrow(
            /at least 32 are required/,
        );
    });

    it('rejects a currentKeyId that is not in the ring', () => {
        expect(() => createKeyring({ keys: { k1: TEST_MASTER_SECRET }, currentKeyId: 'k2' })).toThrow(
            /not present in the keyring/,
        );
    });

    it('rejects a key id containing the envelope separator', () => {
        expect(() => createKeyring({ keys: { 'k.1': TEST_MASTER_SECRET }, currentKeyId: 'k.1' })).toThrow(
            /would collide with the envelope separator/,
        );
    });

    it('trims the master secret at exactly one place, so a trailing newline is not a different key', async () => {
        const clean = createKeyring({ keys: { k: TEST_MASTER_SECRET }, currentKeyId: 'k' });
        const pasted = createKeyring({ keys: { k: `${TEST_MASTER_SECRET}\n` }, currentKeyId: 'k' });
        const registry = createDefaultDecryptorRegistry();

        const wrapped = await encryptSecret({ plaintext: 'sk-secret-value', keyring: clean, aad: AAD });
        const read = await decryptSecret({ envelope: wrapped.envelope, keyring: pasted, registry, aad: AAD });
        expect(read.expose()).toBe('sk-secret-value');
    });

    it('derives the four rotation states from the ring shape alone', () => {
        const single = createKeyring({ keys: { k1: TEST_MASTER_SECRET }, currentKeyId: 'k1' });
        expect(rotationState(single)).toBe('single');

        const dual = createKeyring({ keys: { k1: TEST_MASTER_SECRET, k2: TEST_MASTER_SECRET }, currentKeyId: 'k1' });
        expect(rotationState(dual, 'k1')).toBe('dual');
        const draining = createKeyring({
            keys: { k1: TEST_MASTER_SECRET, k2: TEST_MASTER_SECRET },
            currentKeyId: 'k2',
        });
        expect(rotationState(draining, 'k1')).toBe('drain');
        expect(rotationState(draining, 'k0')).toBe('retire');
    });
});

describe('envelope', () => {
    it('round-trips and produces a five-segment v1 envelope carrying the key id', async () => {
        const keyring = createTestKeyring();
        const registry = createDefaultDecryptorRegistry();
        const { envelope, keyId, formatVersion } = await encryptSecret({
            plaintext: 'sk-abcdef0123456789',
            keyring,
            aad: AAD,
        });

        const parsed = parseEnvelopeOrNull(envelope);
        expect(parsed).not.toBeNull();
        expect(envelope.split('.')).toHaveLength(5);
        expect(parsed!.formatVersion).toBe('v1');
        expect(parsed!.keyId).toBe('test');
        expect(keyId).toBe('test');
        expect(formatVersion).toBe('v1');

        const plain = await decryptSecret({ envelope, keyring, registry, aad: AAD });
        expect(plain.expose()).toBe('sk-abcdef0123456789');
    });

    it('produces different ciphertext for the same key twice — no equality leak', async () => {
        const keyring = createTestKeyring();
        const a = await encryptSecret({ plaintext: 'sk-same', keyring, aad: AAD });
        const b = await encryptSecret({ plaintext: 'sk-same', keyring, aad: AAD });
        expect(a.envelope).not.toBe(b.envelope);
    });

    it('AAD binds the blob to its row — a ciphertext moved to another tenant FAILS to decrypt', async () => {
        const keyring = createTestKeyring();
        const registry = createDefaultDecryptorRegistry();
        const { envelope } = await encryptSecret({ plaintext: 'sk-tenant-a', keyring, aad: AAD });

        await expect(
            decryptSecret({ envelope, keyring, registry, aad: { ...AAD, organizationId: 'org-b' } }),
        ).rejects.toMatchObject({ code: AI_ERROR_CODES.DECRYPT_FAILED });

        await expect(
            decryptSecret({ envelope, keyring, registry, aad: { ...AAD, credentialId: 'cred-2' } }),
        ).rejects.toMatchObject({ code: AI_ERROR_CODES.DECRYPT_FAILED });

        // `provider` is in the tuple, so a provider swap re-derives the binding.
        await expect(
            decryptSecret({ envelope, keyring, registry, aad: { ...AAD, provider: 'anthropic' } }),
        ).rejects.toMatchObject({ code: AI_ERROR_CODES.DECRYPT_FAILED });
    });

    it('encodes null as the empty string so (orgA, null) and (null, orgA) cannot collide', () => {
        const left = buildAad({ ...AAD, formatVersion: 'v1', organizationId: 'x', userId: null });
        const right = buildAad({ ...AAD, formatVersion: 'v1', organizationId: null, userId: 'x' });
        expect(new TextDecoder().decode(left)).not.toBe(new TextDecoder().decode(right));
    });

    it('reports a wrong master secret as DECRYPT_FAILED and a foreign key id as NO_ENCRYPTION_KEY', async () => {
        const registry = createDefaultDecryptorRegistry();
        const writer = createTestKeyring();
        const { envelope } = await encryptSecret({ plaintext: 'sk-x', keyring: writer, aad: AAD });

        // Same key id, different material ⇒ decrypt-failed (EVERY row would fail this way).
        const wrongMaterial = createKeyring({
            keys: { test: 'b3RoZXItbWFzdGVyLXNlY3JldC1mb3Itb3R0YWFpLTMyYnl0ZXMtbWluaW11bQ' },
            currentKeyId: 'test',
        });
        await expect(decryptSecret({ envelope, keyring: wrongMaterial, registry, aad: AAD })).rejects.toMatchObject({
            code: AI_ERROR_CODES.DECRYPT_FAILED,
        });

        // Key id absent from the ring ⇒ a DIFFERENT, actionable code.
        const otherRing = createKeyring({ keys: { other: TEST_MASTER_SECRET }, currentKeyId: 'other' });
        await expect(decryptSecret({ envelope, keyring: otherRing, registry, aad: AAD })).rejects.toMatchObject({
            code: AI_ERROR_CODES.NO_ENCRYPTION_KEY,
        });
    });

    it('rejects an unknown format version BEFORE any crypto runs', async () => {
        const keyring = createTestKeyring();
        const registry = createDefaultDecryptorRegistry();
        const envelope = formatEnvelope({
            formatVersion: 'v9',
            keyId: 'test',
            saltB64: 'AAAA',
            ivB64: 'BBBB',
            cipherB64: 'CCCC',
        });
        await expect(decryptSecret({ envelope, keyring, registry, aad: AAD })).rejects.toMatchObject({
            code: AI_ERROR_CODES.BAD_CIPHERTEXT,
        });
    });

    it('refuses to encrypt an empty secret rather than persisting a bogus envelope', async () => {
        const keyring = createTestKeyring();
        await expect(encryptSecret({ plaintext: '', keyring, aad: AAD })).rejects.toBeInstanceOf(AiProvisioningError);
    });
});

describe('the ciphertext sniffer is a security control', () => {
    it('classifies real provider keys as PLAINTEXT, including dot-bearing ones', () => {
        // A false positive here stores a plaintext provider key unencrypted — the worst
        // failure in the system, with no error anywhere.
        expect(isEnvelope('sk-ant-api03-abcdef')).toBe(false);
        expect(isEnvelope('AIzaSyA-1234567890')).toBe(false);
        // JWT-shaped and structured credentials DO contain dots. The strict check is what
        // makes "real keys contain no dots" an unnecessary premise.
        expect(isEnvelope('eyJhbGciOi.eyJzdWIiOi.SflKxwRJSM')).toBe(false);
        expect(isEnvelope('v1.test.not+base64url.BBBB.CCCC')).toBe(false);
        expect(isEnvelope('v1.test.AAAA.BBBB')).toBe(false);
        expect(isEnvelope('v1.test.AAAA.BBBB.CCCC.DDDD')).toBe(false);
        expect(isEnvelope('v1..AAAA.BBBB.CCCC')).toBe(false);
    });

    it('classifies a well-formed envelope as ciphertext', async () => {
        const { envelope } = await encryptSecret({ plaintext: 'sk-x', keyring: createTestKeyring(), aad: AAD });
        expect(isEnvelope(envelope)).toBe(true);
    });
});

describe('key hint encoding is a cross-package contract', () => {
    it('distinguishes no-secret, short-secret and last-four by LENGTH', () => {
        expect(deriveKeyHint('')).toBe('');
        expect(deriveKeyHint('abc')).toBe(KEY_HINT_MASK);
        expect(deriveKeyHint('abc')).toHaveLength(4);
        expect(deriveKeyHint('sk-abcdefgh')).toBe(`${KEY_HINT_MASK}efgh`);
        expect(deriveKeyHint('sk-abcdefgh')).toHaveLength(8);
    });

    it('honours a provider-aware hintSource', () => {
        expect(deriveKeyHint('sk-abcdefgh', 'none')).toBe(KEY_HINT_MASK);
        const doc = JSON.stringify({ client_email: 'svc@project.iam.example' });
        expect(deriveKeyHint(doc, { path: 'client_email' })).toBe(`${KEY_HINT_MASK}mple`);
    });
});

describe('secret hygiene', () => {
    it('SecretValue cannot leak through stringify, interpolation or spread', () => {
        const secret = new SecretValue('sk-super-secret-value');
        expect(JSON.stringify({ secret })).not.toContain('sk-super-secret-value');
        expect(`${secret}`).not.toContain('sk-super-secret-value');
        expect(String(secret)).not.toContain('sk-super-secret-value');
        expect(JSON.stringify({ ...secret })).not.toContain('sk-super-secret-value');
        expect(Object.keys(secret)).toHaveLength(0);
        // …and the ONE explicit, greppable way out still works.
        expect(secret.expose()).toBe('sk-super-secret-value');
    });

    it('redacts live secrets and echoed auth headers out of upstream messages', () => {
        const message =
            'Request failed: {"headers":{"Authorization":"Bearer sk-live-abcdefgh12345678"},"url":"https://api.example/v1?key=sk-live-abcdefgh12345678"}';
        const cleaned = redactSecrets(message, ['sk-live-abcdefgh12345678']);
        expect(cleaned).not.toContain('sk-live-abcdefgh12345678');
    });

    it('ignores sentinels too short to redact safely', () => {
        expect(redactSecrets('the quick brown fox', ['fox'])).toContain('fox');
    });

    it('trims a submitted secret exactly once and caps its length', () => {
        expect(normalizeSubmittedSecret('  sk-value\n')).toBe('sk-value');
        expect(() => normalizeSubmittedSecret('x'.repeat(9000))).toThrow(/exceeds/);
    });
});
