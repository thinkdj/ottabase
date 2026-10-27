import { describe, expect, it } from 'vitest';
import { cardFromParams } from '../card';
import { ogImageUrl, signCard, verifyCard } from '../sign';

describe('signed image URLs', () => {
    it('round-trips: the URL the server emits is the one the route accepts', async () => {
        const url = await ogImageUrl('https://acme.test', { title: 'Hello & welcome', eyebrow: 'Blog' }, 's3cret');
        expect(url.startsWith('https://acme.test/api/og/image?title=Hello+%26+welcome&eyebrow=Blog&sig=')).toBe(true);
        const params = new URL(url).searchParams;
        const parsed = cardFromParams(params);
        if ('error' in parsed) throw new Error(parsed.error);
        expect(await verifyCard('s3cret', parsed.card, params.get('sig'))).toBe(true);
    });

    it('refuses a changed field, another secret, or no signature', async () => {
        const sig = await signCard('s3cret', { title: 'a' });
        expect(await verifyCard('s3cret', { title: 'b' }, sig)).toBe(false);
        expect(await verifyCard('other', { title: 'a' }, sig)).toBe(false);
        expect(await verifyCard('s3cret', { title: 'a' }, null)).toBe(false);
        expect(await verifyCard('s3cret', { title: 'a' }, sig)).toBe(true);
    });

    it('mounts elsewhere when told', async () => {
        const url = await ogImageUrl('https://acme.test', { title: 'a' }, 's', '/social');
        expect(url.startsWith('https://acme.test/social/image?')).toBe(true);
    });
});
