import { describe, expect, it } from 'vitest';
import { signPreviewToken, verifyPreviewToken } from '../preview-token';

const SECRET = 'test-secret-at-least-32-chars-long!!';

describe('preview tokens', () => {
    it('round-trips a signed payload', async () => {
        const { token, expiresAt } = await signPreviewToken(SECRET, {
            slug: 'my-draft',
            appId: 'otta-web',
            organizationId: 'org-1',
        });

        const payload = await verifyPreviewToken(SECRET, token);
        expect(payload).not.toBeNull();
        expect(payload!.slug).toBe('my-draft');
        expect(payload!.appId).toBe('otta-web');
        expect(payload!.organizationId).toBe('org-1');
        expect(payload!.exp).toBe(expiresAt);
        expect(expiresAt).toBeGreaterThan(Date.now());
    });

    it('omits the org dimension when not provided (platform mode)', async () => {
        const { token } = await signPreviewToken(SECRET, { slug: 's', appId: 'a' });
        const payload = await verifyPreviewToken(SECRET, token);
        expect(payload).not.toBeNull();
        expect('organizationId' in payload!).toBe(false);
    });

    it('rejects a token signed with a different secret', async () => {
        const { token } = await signPreviewToken(SECRET, { slug: 's', appId: 'a' });
        expect(await verifyPreviewToken('another-secret-entirely-here!!!!', token)).toBeNull();
    });

    it('rejects a tampered payload', async () => {
        const { token } = await signPreviewToken(SECRET, { slug: 's', appId: 'a' });
        const [payload, sig] = token.split('.');
        const forged = JSON.parse(Buffer.from(payload, 'base64url').toString());
        forged.slug = 'someone-elses-draft';
        const forgedToken = `${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${sig}`;
        expect(await verifyPreviewToken(SECRET, forgedToken)).toBeNull();
    });

    it('rejects an expired token', async () => {
        const { token } = await signPreviewToken(SECRET, { slug: 's', appId: 'a', ttlMs: 1 });
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(await verifyPreviewToken(SECRET, token)).toBeNull();
    });

    it('rejects malformed tokens without throwing', async () => {
        for (const bad of ['', 'no-dot', '.', 'a.', '.b', 'not-base64!!.also-not', 'YWJj.ZGVm']) {
            expect(await verifyPreviewToken(SECRET, bad)).toBeNull();
        }
    });

    it('clamped expiry is enforced by verify, not trust in the payload', async () => {
        // Forge an unexpired-looking payload with no valid signature.
        const forged = Buffer.from(JSON.stringify({ slug: 's', appId: 'a', exp: Date.now() + 1e9 })).toString(
            'base64url',
        );
        expect(await verifyPreviewToken(SECRET, `${forged}.AAAA`)).toBeNull();
    });
});
