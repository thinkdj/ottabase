import { describe, expect, it } from 'vitest';
import { signPreviewToken, signUnlockToken, verifyPreviewToken, verifyUnlockToken } from '../preview-token';

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

describe('unlock tokens', () => {
    const POST = { postId: 'p1', appId: 'otta-web', organizationId: 'org-1' };

    it('verifies for exactly the post it was signed for', async () => {
        const { token, expiresAt } = await signUnlockToken(SECRET, POST);
        expect(await verifyUnlockToken(SECRET, token, POST)).toBe(true);
        expect(expiresAt).toBeGreaterThan(Date.now());
        expect(await verifyUnlockToken(SECRET, token, { ...POST, postId: 'p2' })).toBe(false);
        expect(await verifyUnlockToken(SECRET, token, { ...POST, appId: 'other-app' })).toBe(false);
        expect(await verifyUnlockToken(SECRET, token, { ...POST, organizationId: null })).toBe(false);
        expect(await verifyUnlockToken('another-secret-entirely-here!!!!', token, POST)).toBe(false);
    });

    it('rejects an expired token', async () => {
        const { token } = await signUnlockToken(SECRET, { ...POST, ttlMs: 1 });
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(await verifyUnlockToken(SECRET, token, POST)).toBe(false);
    });

    it('never accepts a preview token as an unlock token, nor the other way round', async () => {
        const preview = await signPreviewToken(SECRET, { slug: 's', appId: 'otta-web', organizationId: 'org-1' });
        expect(await verifyUnlockToken(SECRET, preview.token, POST)).toBe(false);

        const unlock = await signUnlockToken(SECRET, POST);
        expect(await verifyPreviewToken(SECRET, unlock.token)).toBeNull();
    });

    it('rejects a token whose purpose was rewritten', async () => {
        const { token } = await signUnlockToken(SECRET, POST);
        const [payload, sig] = token.split('.');
        const forged = JSON.parse(Buffer.from(payload, 'base64url').toString());
        forged.purpose = 'preview';
        expect(
            await verifyUnlockToken(
                SECRET,
                `${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${sig}`,
                POST,
            ),
        ).toBe(false);
    });
});
