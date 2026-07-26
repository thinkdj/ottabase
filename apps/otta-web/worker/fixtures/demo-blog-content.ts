import type { BlogDemoPostSeed } from '@ottabase/ottablog/router';
import kitchensinkContent from './kitchensink-content.json';

/**
 * Trusted, public sample content for a freshly provisioned demo deployment.
 * Only blog and changelog are seeded because they are the content types with
 * dedicated public routes in otta-web today.
 *
 * Author list blocks in the `@editorjs/nested-list` shape
 * (`items: [{ content, items }]`) so seeded content round-trips through the
 * editor unchanged — see `kitchensink-content.json` for every block's shape.
 */
export const demoBlogPosts: readonly BlogDemoPostSeed[] = [
    {
        title: 'The Kitchensink of Ottablog',
        slug: 'kitchensink-ottablog',
        excerpt:
            'Every block OttaEditor can write, on one page — text, media, and the interactive ones — so you can see exactly how your theme renders them.',
        content: kitchensinkContent as BlogDemoPostSeed['content'],
        contentType: 'blog',
        isFeatured: true,
        // Absolute public URL: a fresh install has no uploaded media library yet.
        heroImage: {
            url: 'https://images.unsplash.com/photo-1439405326854-014607f694d7?w=1600',
            alt: 'Sunset over open water, seen from just above the waves',
        },
    },
    {
        title: 'A calmer way to ship content',
        slug: 'a-calmer-way-to-ship-content',
        excerpt:
            'How a post actually gets out the door here — from a messy first draft to a publish you do not have to double-check.',
        heroImage: {
            url: 'https://images.unsplash.com/photo-1471922694854-ff1b63b20054?w=1600',
            alt: 'A quiet coastline at first light',
        },
        content: {
            version: '2.28.2',
            blocks: [
                {
                    type: 'header',
                    data: { text: 'Publishing should feel deliberate, not fragile', level: 2 },
                },
                {
                    type: 'paragraph',
                    data: {
                        text: 'The best writing tool is the one you stop noticing. Write the thing, read it the way a visitor will, press publish. If you find yourself fighting the editor instead of the sentence, something has gone wrong — and it is usually the tool, not you.',
                    },
                },
                {
                    type: 'header',
                    data: { text: 'A small editorial rhythm', level: 2 },
                },
                {
                    type: 'list',
                    data: {
                        style: 'unordered',
                        items: [
                            {
                                content:
                                    'Start with a rough draft and one specific reader in mind. Both can change later.',
                                items: [],
                            },
                            {
                                content:
                                    'Preview the whole page, not just the paragraph you are editing — images and spacing tell their own story.',
                                items: [],
                            },
                            {
                                content:
                                    'Write a title and an excerpt that still make sense on their own, out in a feed somewhere.',
                                items: [],
                            },
                        ],
                    },
                },
                {
                    type: 'quote',
                    data: {
                        text: 'A good publishing workflow gives writers confidence and readers clarity.',
                        caption: 'Ottabase editorial principle',
                        alignment: 'left',
                    },
                },
                {
                    type: 'paragraph',
                    data: {
                        text: 'This post is here so you have something real to click through: the article page, the related content, the editor fields, the publish controls. Rewrite it into your own first post, or delete it once you have one.',
                    },
                },
            ],
        },
        contentType: 'blog',
        isFeatured: true,
    },
    {
        title: 'July 2026: A smoother editorial workspace',
        slug: 'july-2026-editorial-workspace',
        excerpt: 'A sample release note — the publishing and review changes that landed in this demo.',
        content: {
            version: '2.28.2',
            blocks: [
                { type: 'header', data: { text: 'What is new', level: 2 } },
                {
                    type: 'list',
                    data: {
                        style: 'unordered',
                        items: [
                            {
                                content:
                                    'A content workspace that keeps articles and release notes side by side, without mixing them up.',
                                items: [],
                            },
                            {
                                content:
                                    'A full block kitchensink, so you can check your theme against every renderer in one scroll.',
                                items: [],
                            },
                            {
                                content:
                                    'Publishing controls scoped per organization — nobody can publish into somebody else’s blog by accident.',
                                items: [],
                            },
                        ],
                    },
                },
                {
                    type: 'paragraph',
                    data: {
                        text: 'This entry is sample content. Rewrite it as your first real release note, or delete it when your product has its own story to tell.',
                    },
                },
            ],
        },
        contentType: 'changelog',
    },
    {
        title: 'June 2026: Faster ways to find the right update',
        slug: 'june-2026-content-discovery',
        excerpt: 'A second release note, so the public changelog timeline has some depth to scroll on day one.',
        content: {
            version: '2.28.2',
            blocks: [
                { type: 'header', data: { text: 'A clearer public timeline', level: 2 } },
                {
                    type: 'paragraph',
                    data: {
                        text: 'Release notes and articles want different things from a reader. One is scanned in ten seconds to answer "did they fix it yet?"; the other is read properly. The public changelog gives the first kind its own timeline, so neither has to pretend to be the other.',
                    },
                },
                {
                    type: 'list',
                    data: {
                        style: 'unordered',
                        items: [
                            {
                                content:
                                    'Every update gets its own URL, so you can link straight to the one that matters.',
                                items: [],
                            },
                            {
                                content: 'The timeline stays short and scannable, even when an entry is long.',
                                items: [],
                            },
                            {
                                content:
                                    'Same editor, same publishing flow, whether you are writing an essay or a bug fix.',
                                items: [],
                            },
                        ],
                    },
                },
            ],
        },
        contentType: 'changelog',
    },
];
