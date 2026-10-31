/**
 * The kitchensink demo post exists to exercise EVERY renderer block. This
 * guards the app-owned fixture itself: if a block type is dropped from the
 * fixture, plugin/renderer coverage silently shrinks. The fixture is seeded as
 * the `kitchensink-ottablog` entry of `demoBlogPosts`. (Handler behavior is tested in
 * packages/ottablog router-seed-demo.test.ts — the handlers live in the
 * package since the router extraction.)
 */
import { describe, expect, it } from 'vitest';
import { demoBlogPosts } from '../worker/fixtures/demo-blog-content';
import kitchensinkContent from '../worker/fixtures/kitchensink-content.json';

type Block = { type: string; data: Record<string, any> };

const blocks = (kitchensinkContent as { blocks: Block[] }).blocks;
const blockOfType = (type: string) => blocks.find((block) => block.type === type)!;

describe('kitchensink fixture', () => {
    it('seeds extended blocks for full plugin coverage', () => {
        const blockTypes = blocks.map((block) => block.type);

        expect(blockTypes).toEqual(
            expect.arrayContaining([
                'raw',
                'beforeAfter',
                'map',
                'mediaEmbed',
                'imageHotspots',
                'layout',
                'mediaGallery',
                'references',
            ]),
        );
    });

    it('opens each section with its heading, in reading order', () => {
        // The section headings are the fixture's spine: they group the blocks a
        // reader (and a theme author) walks through, so their order is pinned.
        const sections = blocks.filter((block) => block.type === 'header').map((block) => block.data.text);

        expect(sections).toEqual([
            'The Ottablog Kitchensink',
            'Text Blocks',
            'Lists',
            'Code &amp; Data',
            'Visual &amp; Embed Blocks',
            'Media',
            'Interactive Blocks',
            'Rich Content Blocks',
            'References',
        ]);
    });

    it('places the before/after comparison inside the text section, ahead of the quote', () => {
        const order = blocks.map((block) => block.type);
        expect(order.indexOf('beforeAfter')).toBeLessThan(order.indexOf('quote'));
    });

    it('points every image at an outside address that survives a fresh install', () => {
        // A demo deployment has no uploaded media library, so a stored file (or a relative
        // /api/files/public/... path, fine on the authoring host) would 404 here. Outside
        // images stay plain strings in the FileSource fields.
        const sources: unknown[] = [
            blockOfType('beforeAfter').data.before,
            blockOfType('beforeAfter').data.after,
            blockOfType('imageHotspots').data.image,
            blockOfType('mediaEmbed').data.media,
            ...blockOfType('mediaGallery').data.items.map((item: { media: unknown }) => item.media),
            demoBlogPosts.find((post) => post.slug === 'kitchensink-ottablog')!.heroImage!.image,
        ];

        for (const source of sources) expect(source).toMatch(/^https:\/\//);
    });

    it('keeps both hotspots inside the image bounds', () => {
        const hotspots = blockOfType('imageHotspots').data.hotspots as Array<{ x: number; y: number; title: string }>;

        expect(hotspots.map((hotspot) => [hotspot.x, hotspot.y])).toEqual([
            [23, 20],
            [62, 65],
        ]);
        for (const { x, y } of hotspots) {
            expect(x).toBeGreaterThan(0);
            expect(x).toBeLessThan(100);
            expect(y).toBeGreaterThan(0);
            expect(y).toBeLessThan(100);
        }
    });
});
