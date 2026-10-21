/**
 * The demo seed (POST /api/blog/seed-demo) refuses to write anything while one fixture is
 * malformed, so a bad fixture is a demo install with no content at all. These are the fixtures
 * `worker/routes/blog.ts` hands it, checked the way the seed checks them, plus what only the app
 * can know: that the images it serves itself are really in `public/`.
 */
import { demoSeedProblems } from '@ottabase/ottablog/router';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { demoBlogPosts } from '../worker/fixtures/demo-blog-content';
import { demoWhatsNewPosts } from '../worker/fixtures/demo-whats-new';

const seeds = [...demoBlogPosts, ...demoWhatsNewPosts];

describe('demo seed fixtures', () => {
    it('pass the seed check: every field known and well typed, every slug once', () => {
        expect(demoSeedProblems(seeds)).toEqual([]);
    });

    it('seed both the blog and the changelog', () => {
        const types = new Set(seeds.map((seed) => seed.contentType));
        expect(types.has('blog')).toBe(true);
        expect(types.has('changelog')).toBe(true);
    });

    it('give every hero image alt text', () => {
        for (const seed of seeds) {
            if (seed.heroImage) expect(seed.heroImage.alt?.trim(), seed.slug).toBeTruthy();
        }
    });

    it('point app-served images at files that ship in public/', () => {
        const local = JSON.stringify(seeds).match(/"\/[^"]+\.(?:webp|png|jpe?g|svg|gif|avif)"/g) ?? [];
        expect(local.length).toBeGreaterThan(0);
        for (const quoted of local) {
            const file = path.join(__dirname, '..', 'public', JSON.parse(quoted) as string);
            expect(fs.existsSync(file), quoted).toBe(true);
        }
    });
});
