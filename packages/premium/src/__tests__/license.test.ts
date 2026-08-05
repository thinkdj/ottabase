// ============================================================
// License verification — the security boundary of the whole framework.
//
// Every test here answers one question: can a customer unlock a paid package
// WITHOUT the vendor's private key? A pass means no; a regression here means the
// licensing is decorative.
// ============================================================

import { beforeAll, describe, expect, it } from 'vitest';
import { generateLicenseKeypair, issueLicense } from '../license/issue';
import { bytesToBase64Url, parseLicenseToken } from '../license/token';
import { verifyLicense } from '../license/verify';

const HOUR = 3600;
const DAY = 24 * HOUR;

let keys: { publicKey: string; privateKey: string };
let otherKeys: { publicKey: string; privateKey: string };

beforeAll(async () => {
    keys = await generateLicenseKeypair();
    otherKeys = await generateLicenseKeypair();
});

const base = { pkg: 'webhooks', plan: 'pro', licensee: 'Acme Inc' } as const;

describe('license round-trip', () => {
    it('accepts a freshly issued license', async () => {
        const token = await issueLicense({ ...base, features: ['deliveries.log'] }, keys.privateKey, {
            expiresInDays: 365,
        });

        const result = await verifyLicense(token, { packageKey: 'webhooks', publicKey: keys.publicKey });

        expect(result.state).toBe('active');
        expect(result.reason).toBe('OK');
        expect(result.claims?.licensee).toBe('Acme Inc');
        expect(result.claims?.features).toEqual(['deliveries.log']);
        expect(result.expiresIn).toBeGreaterThan(0);
    });

    it('treats a license with no exp as perpetual, not as expired at epoch', async () => {
        const token = await issueLicense(base, keys.privateKey);
        const result = await verifyLicense(token, { packageKey: 'webhooks', publicKey: keys.publicKey });

        expect(result.state).toBe('active');
        expect(result.expiresIn).toBeNull();
    });

    it('fills in id and iat when the vendor omits them', async () => {
        const token = await issueLicense(base, keys.privateKey);
        const parsed = parseLicenseToken(token);

        expect(parsed?.claims.id).toMatch(/^lic_/);
        expect(parsed?.claims.iat).toBeGreaterThan(0);
    });
});

describe('forgery resistance', () => {
    it('rejects a token signed by a different key', async () => {
        const token = await issueLicense(base, otherKeys.privateKey);
        const result = await verifyLicense(token, { packageKey: 'webhooks', publicKey: keys.publicKey });

        expect(result.state).toBe('invalid');
        expect(result.reason).toBe('LICENSE_SIGNATURE_INVALID');
        expect(result.claims).toBeNull();
    });

    it('rejects a token whose claims were edited after signing', async () => {
        const token = await issueLicense({ ...base, plan: 'starter' }, keys.privateKey);
        const [prefix, , signature] = token.split('.');

        // Re-encode the payload with an upgraded plan — the attack the signature exists to stop.
        const forgedPayload = bytesToBase64Url(
            new TextEncoder().encode(JSON.stringify({ ...base, plan: 'enterprise', id: 'lic_x', iat: 1 })),
        );

        const result = await verifyLicense(`${prefix}.${forgedPayload}.${signature}`, {
            packageKey: 'webhooks',
            publicKey: keys.publicKey,
        });

        expect(result.state).toBe('invalid');
        expect(result.reason).toBe('LICENSE_SIGNATURE_INVALID');
    });

    it('rejects a license issued for a different package', async () => {
        const token = await issueLicense({ ...base, pkg: 'reports' }, keys.privateKey);
        const result = await verifyLicense(token, { packageKey: 'webhooks', publicKey: keys.publicKey });

        expect(result.state).toBe('invalid');
        expect(result.reason).toBe('LICENSE_PACKAGE_MISMATCH');
    });

    it('rejects a license bound to a different appId', async () => {
        const token = await issueLicense({ ...base, appId: 'acme-prod' }, keys.privateKey);
        const result = await verifyLicense(token, {
            packageKey: 'webhooks',
            publicKey: keys.publicKey,
            appId: 'acme-staging',
        });

        expect(result.state).toBe('invalid');
        expect(result.reason).toBe('LICENSE_APP_MISMATCH');
    });

    it('rejects an app-bound license when the verifier cannot establish an app id', async () => {
        const token = await issueLicense({ ...base, appId: 'acme-prod' }, keys.privateKey);
        const result = await verifyLicense(token, { packageKey: 'webhooks', publicKey: keys.publicKey });

        expect(result.state).toBe('invalid');
        expect(result.reason).toBe('LICENSE_APP_MISMATCH');
    });

    it('accepts an unbound license in any app', async () => {
        const token = await issueLicense(base, keys.privateKey);
        const result = await verifyLicense(token, {
            packageKey: 'webhooks',
            publicKey: keys.publicKey,
            appId: 'anything',
        });

        expect(result.state).toBe('active');
    });

    it.each([
        ['empty', ''],
        ['not a token', 'hello'],
        ['wrong prefix', 'jwt.aaa.bbb'],
        ['two segments', 'obp1.aaa'],
        ['payload is not json', 'obp1.bm90LWpzb24.c2ln'],
    ])('reports %s as malformed rather than throwing', async (_label, token) => {
        const result = await verifyLicense(token, { packageKey: 'webhooks', publicKey: keys.publicKey });
        expect(['invalid', 'unlicensed']).toContain(result.state);
    });

    it('rejects a signed token with malformed entitlement claims before a gate consumes them', async () => {
        const token = await issueLicense(
            { ...base, features: 'deliveries.log' as unknown as string[] },
            keys.privateKey,
        );
        const result = await verifyLicense(token, { packageKey: 'webhooks', publicKey: keys.publicKey });

        expect(result.state).toBe('invalid');
        expect(result.reason).toBe('LICENSE_MALFORMED');
    });
});

describe('expiry and grace', () => {
    const now = 1_800_000_000;

    it('stays active before expiry', async () => {
        const token = await issueLicense({ ...base, exp: now + DAY }, keys.privateKey);
        const result = await verifyLicense(token, { packageKey: 'webhooks', publicKey: keys.publicKey, now });

        expect(result.state).toBe('active');
    });

    it('keeps serving inside the grace window, loudly', async () => {
        const token = await issueLicense({ ...base, exp: now - 2 * DAY }, keys.privateKey);
        const result = await verifyLicense(token, { packageKey: 'webhooks', publicKey: keys.publicKey, now });

        expect(result.state).toBe('grace');
        expect(result.reason).toBe('IN_GRACE');
        expect(result.expiresIn).toBeLessThan(0);
    });

    it('stops serving past the grace window', async () => {
        const token = await issueLicense({ ...base, exp: now - 30 * DAY }, keys.privateKey);
        const result = await verifyLicense(token, { packageKey: 'webhooks', publicKey: keys.publicKey, now });

        expect(result.state).toBe('expired');
        expect(result.reason).toBe('LICENSE_EXPIRED');
        // Claims survive an expiry so the admin UI can still say WHOSE license lapsed.
        expect(result.claims?.licensee).toBe('Acme Inc');
    });

    it('honours graceDays: 0 as a hard cut-off', async () => {
        const token = await issueLicense({ ...base, exp: now - 60 }, keys.privateKey);
        const result = await verifyLicense(token, {
            packageKey: 'webhooks',
            publicKey: keys.publicKey,
            graceDays: 0,
            now,
        });

        expect(result.state).toBe('expired');
    });

    it('refuses a license that is not valid yet', async () => {
        const token = await issueLicense({ ...base, nbf: now + DAY }, keys.privateKey);
        const result = await verifyLicense(token, { packageKey: 'webhooks', publicKey: keys.publicKey, now });

        expect(result.state).toBe('invalid');
        expect(result.reason).toBe('LICENSE_NOT_YET_VALID');
    });
});

describe('unlicensed and free packages', () => {
    it('reports a missing license as unlicensed, not invalid', async () => {
        const result = await verifyLicense(null, { packageKey: 'webhooks', publicKey: keys.publicKey });

        expect(result.state).toBe('unlicensed');
        expect(result.reason).toBe('LICENSE_MISSING');
    });

    it('treats a package with no public key as free, with no claims', async () => {
        const result = await verifyLicense(null, { packageKey: 'internal-tool' });

        expect(result.state).toBe('active');
        expect(result.claims).toBeNull();
    });
});
