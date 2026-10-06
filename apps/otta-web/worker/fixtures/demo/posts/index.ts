import type { BlogDemoPostSeed } from '@ottabase/ottablog/router';
import { IMAGES, unsplash } from '../images';
import kitchensinkContent from '../../kitchensink-content.json';
import { ARTICLES } from './articles';
import { BLURBS } from './blurbs';
import { JOURNALS } from './journals';
import { RELEASE_NOTES } from './release-notes';
import { EDGE_SERIES } from './series-edge';

/**
 * The kitchensink writes every block OttaEditor supports once, so a theme can be checked end to
 * end on one page. It stays first: the fixture test guards its block coverage. Block lists use the
 * nested-list shape (`items: [{ content, items }]`) so the post round-trips through the editor.
 */
const KITCHENSINK: BlogDemoPostSeed = {
    title: 'The Kitchensink of Ottablog',
    slug: 'kitchensink-ottablog',
    excerpt:
        'Every block OttaEditor can write, on one page: text, media and the interactive ones, so you can see exactly how your theme renders them.',
    content: kitchensinkContent as BlogDemoPostSeed extends { content?: infer C } ? NonNullable<C> : never,
    contentType: 'blog',
    publishedAt: '2026-03-30T10:00:00.000Z',
    categories: ['Engineering'],
    tags: ['Editor', 'Themes'],
    heroImage: { url: unsplash(IMAGES.sunsetWaves), alt: IMAGES.sunsetWaves.alt },
};

/** Every seeded post, kitchensink first */
export const DEMO_POSTS: readonly BlogDemoPostSeed[] = [
    KITCHENSINK,
    ...EDGE_SERIES,
    ...ARTICLES,
    ...RELEASE_NOTES,
    ...BLURBS,
    ...JOURNALS,
];
