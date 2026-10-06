/**
 * The demo content is copy people will read on a fresh install, so it is held to rules: unique
 * keys, public images, dates in the past, authors who exist, blurbs that fit, and no long dashes.
 */
import { BLURB_MAX_LENGTH } from '@ottabase/ottablog';
import { describe, expect, it } from 'vitest';
import { DEMO_MEDIA, DEMO_POSTS, MENUS, PEOPLE, SHORTLINKS, THREADS } from '../worker/fixtures/demo';

const emails = new Set(PEOPLE.map((person) => person.email));
const slugs = DEMO_POSTS.map((post) => post.slug);
const everything = JSON.stringify({ DEMO_MEDIA, DEMO_POSTS, MENUS, PEOPLE, SHORTLINKS, THREADS });
/** The editorial content: everything but the kitchensink, which carries the renderer's own test images */
const editorial = JSON.stringify({ posts: DEMO_POSTS.slice(1), PEOPLE, THREADS });

describe('demo content', () => {
    it('keys every list on something unique', () => {
        expect(new Set(slugs).size).toBe(slugs.length);
        expect(emails.size).toBe(PEOPLE.length);
        expect(new Set(DEMO_MEDIA.map((m) => m.storageKey)).size).toBe(DEMO_MEDIA.length);
        expect(new Set(SHORTLINKS.map((l) => l.code)).size).toBe(SHORTLINKS.length);
        expect(new Set(MENUS.map((m) => m.slug)).size).toBe(MENUS.length);
    });

    it('reads without long dashes, in copy or captions', () => {
        expect(everything).not.toMatch(/[\u2013\u2014]/);
    });

    it('covers every content type the public site renders, with the kitchensink first', () => {
        expect(DEMO_POSTS[0]!.slug).toBe('kitchensink-ottablog');
        const types = new Set(DEMO_POSTS.map((post) => post.contentType));
        expect([...types].sort()).toEqual(['blog', 'blurb', 'changelog', 'photo']);
        expect(DEMO_POSTS.filter((post) => post.isFeatured).length).toBeGreaterThanOrEqual(2);
    });

    it('dates every post in the past and spreads them over months', () => {
        const dates = DEMO_POSTS.map((post) => Date.parse(post.publishedAt!));
        for (const date of dates) {
            expect(Number.isFinite(date)).toBe(true);
            expect(date).toBeLessThan(Date.now());
        }
        const months = new Set(dates.map((d) => new Date(d).toISOString().slice(0, 7)));
        expect(months.size).toBeGreaterThanOrEqual(6);
    });

    it('credits only people who exist, and spreads the writing across them', () => {
        const authors = DEMO_POSTS.map((post) => post.authorEmail).filter(Boolean) as string[];
        for (const email of authors) expect(emails.has(email)).toBe(true);
        expect(new Set(authors).size).toBe(PEOPLE.length);
        for (const thread of THREADS) {
            expect(slugs).toContain(thread.slug);
            for (const comment of thread.comments) {
                expect(emails.has(comment.authorEmail)).toBe(true);
                for (const reply of comment.replies ?? []) expect(emails.has(reply.authorEmail)).toBe(true);
            }
        }
    });

    it('points every image at a public Unsplash URL the media library also carries', () => {
        const photoId = (url: string) => url.match(/photo-([^?"]+)/)![1];
        const library = new Set(DEMO_MEDIA.map((m) => photoId(m.url)));
        const urls = editorial.match(/https:\/\/images\.unsplash\.com\/photo-[^"]+/g) ?? [];
        expect(urls.length).toBeGreaterThan(10);
        for (const url of urls) expect(library.has(photoId(url))).toBe(true);
        for (const item of DEMO_MEDIA) {
            expect(item.url).toMatch(/^https:\/\/images\.unsplash\.com\/photo-\d+-[0-9a-f]+\?w=1600&q=80$/);
            expect(item.altText.length).toBeGreaterThan(8);
        }
    });

    it('keeps blurbs within the limit and gives every journal photographs with ids', () => {
        for (const post of DEMO_POSTS) {
            if (post.contentType === 'blurb') expect(post.blurbText.length).toBeLessThanOrEqual(BLURB_MAX_LENGTH);
            if (post.contentType === 'photo') {
                expect(post.photoAlbum.length).toBeGreaterThanOrEqual(3);
                expect(new Set(post.photoAlbum.map((p) => p.id)).size).toBe(post.photoAlbum.length);
                for (const photo of post.photoAlbum) expect(photo.location).toBeTruthy();
            }
            if ('content' in post) {
                expect(post.content.blocks.length).toBeGreaterThan(2);
                expect(post.excerpt?.length ?? 0).toBeGreaterThan(40);
            }
        }
    });

    it('links the series in order and ties shortlinks to real pages', () => {
        const series = DEMO_POSTS.filter((post) => post.series).map((post) => post.series!.order);
        expect(series).toEqual([1, 2, 3, 4]);
        for (const link of SHORTLINKS) {
            if (link.to.startsWith('/blog/') && !link.to.startsWith('/blog/series/')) {
                expect(slugs).toContain(link.to.replace('/blog/', ''));
            }
        }
    });
});
