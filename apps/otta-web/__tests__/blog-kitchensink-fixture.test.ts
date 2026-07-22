/**
 * The kitchensink demo post exists to exercise EVERY renderer block. This
 * guards the app-owned fixture itself: if a block type is dropped from the
 * fixture, plugin/renderer coverage silently shrinks. (Handler behavior is
 * tested in packages/ottablog router-kitchensink.test.ts — the handlers live
 * in the package since the router extraction.)
 */
import { describe, expect, it } from 'vitest';
import kitchensinkContent from '../worker/fixtures/kitchensink-content.json';

describe('kitchensink fixture', () => {
    it('seeds extended blocks for full plugin coverage', () => {
        const blocks = (kitchensinkContent as { blocks: Array<{ type: string }> }).blocks;
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
});
