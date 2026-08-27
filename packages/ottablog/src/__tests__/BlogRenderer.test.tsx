import { act, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { BlogExcerptCard, BlogRenderer, BlurbRenderer, type BlogPostData } from '../components/BlogRenderer';

const createMockPost = (overrides?: Partial<BlogPostData>): BlogPostData => ({
    id: 'test-post-1',
    title: 'Test Post',
    slug: 'test-post',
    excerpt: 'Test excerpt',
    content: {
        time: Date.now(),
        blocks: [],
        version: '2.28.0',
    },
    contentType: 'blog',
    status: 'published',
    authorId: 'author-1',
    author: { id: 'author-1', name: 'Test Author', image: null },
    createdAt: Date.parse('2024-01-15T00:00:00Z'),
    ...overrides,
});

describe('BlogRenderer', () => {
    describe('Blurb auto-linking', () => {
        const linkPost = () =>
            createMockPost({
                contentType: 'blurb',
                blurbText: 'Reading https://example.com/post today.',
                content: null,
            });

        it('links URLs in the detail variant', async () => {
            const { container } = render(<BlurbRenderer post={linkPost()} variant="detail" />);
            await waitFor(() => expect(container.querySelector('a[href="https://example.com/post"]')).not.toBeNull());
        });

        it('renders URLs as plain text in the timeline variant', async () => {
            // Timeline cards are wrapped in a link by the caller, so an anchor here would nest
            // inside it: invalid DOM, and one click would both open the URL and navigate the card.
            const { container } = render(<BlurbRenderer post={linkPost()} variant="timeline" />);
            await waitFor(() => expect(container.textContent).toContain('https://example.com/post'));
            expect(container.querySelector('a')).toBeNull();
        });
    });

    describe('Blurb crossposts', () => {
        const crosspostPost = () =>
            createMockPost({
                contentType: 'blurb',
                blurbText: 'Also went out on the socials.',
                content: null,
                crossposts: [
                    { url: 'https://www.instagram.com/p/abc', origin: true },
                    { url: 'https://x.com/me/status/1' },
                    { url: 'https://facebook.com/me/posts/2' },
                ],
            });

        it('splits the byline into where it came from and where copies went', async () => {
            const { container } = render(<BlurbRenderer post={crosspostPost()} variant="detail" />);

            await waitFor(() => expect(container.textContent).toContain('originally on'));
            expect(container.textContent).toContain('instagram.com');
            expect(container.textContent).toContain('also on');
            // Microformats: the origin is this post's u-url, the copies are u-syndication.
            expect(container.querySelector('a.u-url')?.getAttribute('href')).toBe('https://www.instagram.com/p/abc');
            expect(container.querySelectorAll('a.u-syndication')).toHaveLength(2);
        });

        it('degrades to plain text in the timeline, where the card is already a link', async () => {
            const { container } = render(<BlurbRenderer post={crosspostPost()} variant="timeline" />);

            await waitFor(() => expect(container.textContent).toContain('instagram.com'));
            expect(container.querySelector('a')).toBeNull();
        });

        it('shows the same row on an article and a photo journal, not just a blurb', async () => {
            const links = [{ url: 'https://x.com/me/status/1' }];

            const article = render(
                <BlogRenderer post={createMockPost({ crossposts: links })} disableHooks />,
            ).container;
            await waitFor(() => expect(article.querySelector('.blog-crossposts')).not.toBeNull());
            expect(article.querySelector('a.u-syndication')?.getAttribute('href')).toBe('https://x.com/me/status/1');

            const journal = render(
                <BlogRenderer
                    post={createMockPost({
                        contentType: 'photo',
                        content: null,
                        photoAlbum: [{ id: 'p1', url: 'https://images.test/1.jpg' }],
                        crossposts: links,
                    })}
                    disableHooks
                />,
            ).container;
            await waitFor(() => expect(journal.querySelector('.blog-crossposts')).not.toBeNull());
            expect(journal.querySelector('a.u-syndication')?.getAttribute('href')).toBe('https://x.com/me/status/1');
        });

        it('renders no crosspost row at all when a post has none', () => {
            const { container } = render(<BlogRenderer post={createMockPost()} disableHooks />);
            expect(container.querySelector('.blog-crossposts')).toBeNull();
        });

        it('drops a crosspost whose URL cannot be rendered as a safe link', async () => {
            const post = createMockPost({
                contentType: 'blurb',
                blurbText: 'One good link, one bad.',
                content: null,
                crossposts: [{ url: 'javascript:alert(1)' }, { url: 'https://x.com/me/status/1' }],
            });
            const { container } = render(<BlurbRenderer post={post} variant="detail" />);

            await waitFor(() => expect(container.textContent).toContain('x.com'));
            expect(container.querySelectorAll('a.u-syndication')).toHaveLength(1);
        });

        it('sanitizes a caller-provided card href before handing it to a link component', async () => {
            const LinkComponent = ({ href, children }: { href: string; children: ReactNode }) => (
                <a href={href}>{children}</a>
            );
            const { container } = render(
                <BlogExcerptCard
                    post={createMockPost({ contentType: 'blurb', content: null, blurbText: 'Safe wrapper.' })}
                    href="javascript:alert(1)"
                    LinkComponent={LinkComponent}
                />,
            );

            await waitFor(() => expect(container.querySelector('a')?.getAttribute('href')).toBe('#'));
        });
    });

    describe('Safe rendering', () => {
        it('renders a blurb as short-form text instead of an article body', async () => {
            const blurb = createMockPost({
                title: 'Internal generated title',
                contentType: 'blurb',
                blurbText: 'Watched xyz today. https://example.com/review',
                content: null,
            });
            const { container } = render(<BlogRenderer post={blurb} disableHooks />);

            expect(container.querySelector('.blog-blurb--detail')).toBeTruthy();
            expect(container.textContent).toContain('Watched xyz today.');
            expect(container.querySelector('h1')?.classList.contains('sr-only')).toBe(true);
            expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com/review');
        });

        it('uses the compact blurb renderer in listing cards', async () => {
            const blurb = createMockPost({ contentType: 'blurb', blurbText: 'A passing thought', content: null });
            const { container } = render(<BlogExcerptCard post={blurb} />);
            await waitFor(() => expect(container.querySelector('.blog-blurb--timeline')).toBeTruthy());
            expect(container.textContent).toContain('A passing thought');
        });

        it('escapes markup and does not turn non-HTTP protocols into links', () => {
            const blurb = createMockPost({
                contentType: 'blurb',
                blurbText: '<img src=x onerror=alert(1)> javascript:alert(1)',
                content: null,
            });
            const { container } = render(<BlogRenderer post={blurb} disableHooks />);

            expect(container.querySelector('img')).toBeNull();
            expect(container.querySelector('a')).toBeNull();
            expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
        });

        it('renders a photo journal as an editorial contact sheet', () => {
            const journal = createMockPost({
                title: 'Kyoto, in the rain',
                contentType: 'photo',
                photoNote: 'A quiet blue hour.',
                photoAlbum: [
                    {
                        id: 'p1',
                        url: 'https://images.test/kyoto.jpg',
                        alt: 'Lanterns reflected in a wet lane',
                        caption: 'After the last train',
                        location: 'Kyoto, Japan',
                    },
                ],
                content: null,
            });
            const { container } = render(<BlogRenderer post={journal} disableHooks />);

            expect(container.querySelector('.blog-photo-journal--detail')).toBeTruthy();
            expect(container.textContent).toContain('Photo journal · 1 frame');
            expect(container.textContent).toContain('A quiet blue hour.');
            expect(container.querySelector('img')?.getAttribute('alt')).toBe('Lanterns reflected in a wet lane');
        });

        it('omits unrenderable photo dates instead of crashing the public renderer', () => {
            const journal = createMockPost({
                contentType: 'photo',
                publishedAt: 1e20,
                photoAlbum: [{ id: 'p1', url: 'https://images.test/kyoto.jpg', takenAt: 1e20 }],
                content: null,
            });

            expect(() => render(<BlogRenderer post={journal} disableHooks />)).not.toThrow();
        });

        it('lets a surrounding page own the journal header without duplicating it', () => {
            // showTitle/showMetadata are declared on BlogRendererProps for EVERY content type, so a
            // shell that renders its own header and turns them off expects a journal to obey the
            // same contract an article does. It used to draw its header regardless — two <h1>s.
            const journal = createMockPost({
                title: 'Kyoto, in the rain',
                contentType: 'photo',
                photoNote: 'A quiet blue hour.',
                photoAlbum: [{ id: 'p1', url: 'https://images.test/kyoto.jpg' }],
                publishedAt: Date.parse('2024-01-15T00:00:00Z'),
                content: null,
            });

            const owned = render(<BlogRenderer post={journal} showTitle={false} showMetadata={false} disableHooks />);
            expect(owned.container.querySelector('h1')).toBeNull();
            expect(owned.container.textContent).not.toContain('Photo journal · 1 frame');
            expect(owned.container.textContent).not.toContain('Test Author');
            // The field note is authored body copy, not chrome — the excerpt is derived FROM it —
            // so owning the header must never delete it.
            expect(owned.container.textContent).toContain('A quiet blue hour.');
            // The album is the point of the page and is never part of the header contract.
            expect(owned.container.querySelectorAll('img')).toHaveLength(1);
            owned.unmount();

            // Absent still means shown: PhotoJournalRenderer forwards props without ArticleBlogRenderer's
            // defaults, so anything other than an explicit `false` keeps the full header.
            const { container } = render(<BlogRenderer post={journal} disableHooks />);
            expect(container.querySelector('h1')?.textContent).toBe('Kyoto, in the rain');
            expect(container.textContent).toContain('Photo journal · 1 frame');
            expect(container.textContent).toContain('Test Author');
        });

        it('varies journal frames by photograph while never stretching one into blank space', () => {
            const journal = createMockPost({
                contentType: 'photo',
                photoAlbum: [
                    { id: 'p0', url: 'https://images.test/0.jpg', width: 1800, height: 1200 }, // 3:2 wide
                    { id: 'p1', url: 'https://images.test/1.jpg', width: 900, height: 1600 }, // portrait
                    { id: 'p2', url: 'https://images.test/2.jpg', width: 1000, height: 1000 }, // square
                    { id: 'p3', url: 'https://images.test/3.jpg' }, // no dimensions
                    { id: 'p4', url: 'https://images.test/4.jpg', width: 1600, height: 1200 }, // 4:3
                ],
                content: null,
            });
            const { container } = render(<BlogRenderer post={journal} disableHooks />);

            const figures = Array.from(container.querySelectorAll('figure'));
            const frameOf = (figure: Element) => figure.querySelector('button')?.className ?? '';

            // Each photograph keeps its own shape — this variation is the layout, not a side effect.
            expect(frameOf(figures[0])).toContain('aspect-[3/2]');
            expect(frameOf(figures[1])).toContain('aspect-[3/4]');
            expect(frameOf(figures[2])).toContain('aspect-square');
            expect(frameOf(figures[4])).toContain('aspect-[4/3]');
            // Unknown dimensions still vary rather than collapsing to one ratio.
            expect(frameOf(figures[3])).toMatch(/aspect-\[3\/4\]|aspect-\[4\/3\]/);
            // Four distinct ratios across five photographs: the grid is never uniform brickwork.
            expect(new Set(figures.map((figure) => frameOf(figure).split(' ')[0])).size).toBeGreaterThanOrEqual(3);

            // The grid must not stretch a short tile: that padding was the empty frame.
            const grid = container.querySelector('.blog-photo-journal--detail .grid');
            expect(grid?.className).toContain('items-start');
        });

        it('pairs journal column spans so a row fills exactly twelve', () => {
            const journal = createMockPost({
                contentType: 'photo',
                photoAlbum: Array.from({ length: 6 }, (_, index) => ({
                    id: `p${index}`,
                    url: `https://images.test/${index}.jpg`,
                })),
                content: null,
            });
            const { container } = render(<BlogRenderer post={journal} disableHooks />);

            const spans = Array.from(container.querySelectorAll('figure')).map(
                (figure) => Number(figure.className.match(/md:col-span-(\d+)/)?.[1]) || 0,
            );
            // Pairs that sum to 12 keep the two photographs in a row close in height, which is what
            // keeps the ragged edge pleasant instead of gaping.
            expect(spans[0] + spans[1]).toBe(12);
            expect(spans[2] + spans[3]).toBe(12);
            expect(spans[4] + spans[5]).toBe(12);
        });

        it('runs the content lifecycle for a journal body, and only on the detail view', async () => {
            const { addFilter, addAction, HOOKS } = await import('../hooks');
            const filtered: unknown[] = [];
            const before: unknown[] = [];
            const after: unknown[] = [];
            addFilter(HOOKS['post.content.filter'], (value: unknown) => {
                filtered.push(value);
                return value;
            });
            addAction(HOOKS['post.content.before'], (value: unknown) => {
                before.push(value);
            });
            addAction(HOOKS['post.content.after'], (value: unknown) => {
                after.push(value);
            });

            const journal = createMockPost({
                contentType: 'photo',
                photoAlbum: [{ id: 'p1', url: 'https://images.test/one.jpg' }],
                content: { blocks: [{ type: 'paragraph', data: { text: 'The rain emptied the streets.' } }] },
            });

            // A timeline card never renders the body, so filtering it there is work thrown away.
            const card = render(<BlogExcerptCard post={journal} />);
            await waitFor(() => expect(filtered).toHaveLength(0));
            expect(before).toHaveLength(0);
            card.unmount();

            // Detail runs both, and the action waits for the filter to settle.
            const detail = render(<BlogRenderer post={journal} />);
            await waitFor(() => expect(before).toHaveLength(1));
            expect(after).toHaveLength(0);

            // A parent rerender must NOT churn the pair. filteredPost/filteredProps are fresh
            // objects every render, so depending on them would fire after+before on every tick.
            detail.rerender(<BlogRenderer post={journal} />);
            detail.rerender(<BlogRenderer post={journal} />);
            await waitFor(() => expect(filtered.length).toBeGreaterThan(0));
            expect(before).toHaveLength(1);
            expect(after).toHaveLength(0);

            // And `after` runs exactly once, when the body actually goes away.
            detail.unmount();
            await waitFor(() => expect(after).toHaveLength(1));
        });

        it('closes one journal lifecycle before opening the next, with the right body each time', async () => {
            const { addFilter, addAction, HOOKS } = await import('../hooks');
            const before: any[] = [];
            const after: any[] = [];
            addFilter(HOOKS['post.content.filter'], (value: unknown) => value);
            addAction(HOOKS['post.content.before'], (value: unknown) => {
                before.push(value);
            });
            addAction(HOOKS['post.content.after'], (value: unknown) => {
                after.push(value);
            });

            const journal = (id: string, text: string) =>
                createMockPost({
                    id,
                    contentType: 'photo',
                    photoAlbum: [{ id: `${id}-p1`, url: `https://images.test/${id}.jpg` }],
                    content: { blocks: [{ type: 'paragraph', data: { text } }] },
                });

            const view = render(<BlogRenderer post={journal('journal-a', 'Alpha body')} />);
            await waitFor(() => expect(before).toHaveLength(1));
            expect(before[0].id).toBe('journal-a');

            // Switching posts: A's cleanup must report A, not whichever journal is now on screen.
            view.rerender(<BlogRenderer post={journal('journal-b', 'Bravo body')} />);
            await waitFor(() => expect(before).toHaveLength(2));

            expect(after).toHaveLength(1);
            expect(after[0].id).toBe('journal-a');
            expect(after[0].content.blocks[0].data.text).toBe('Alpha body');

            // B opens exactly once, and never with A's body.
            expect(before[1].id).toBe('journal-b');
            expect(before[1].content.blocks[0].data.text).toBe('Bravo body');
            expect(before.filter((entry) => entry.id === 'journal-b')).toHaveLength(1);
        });

        it('never commits a stale filter result when the same post ID is refetched', async () => {
            const { addFilter, HOOKS, removeHook } = await import('../hooks');
            const pending: Array<(value: string) => void> = [];
            addFilter(
                HOOKS['post.title.filter'],
                () => new Promise<string>((resolve) => pending.push(resolve)),
                undefined,
                'same-id-refetch',
            );

            const view = render(<BlogRenderer post={createMockPost({ title: 'First input' })} />);
            await waitFor(() => expect(pending).toHaveLength(1));

            view.rerender(<BlogRenderer post={createMockPost({ title: 'Second input' })} />);
            await waitFor(() => expect(pending).toHaveLength(2));

            await act(async () => pending[0]('STALE RESULT'));
            expect(view.container.textContent).toContain('Second input');
            expect(view.container.textContent).not.toContain('STALE RESULT');

            await act(async () => pending[1]('FRESH RESULT'));
            await waitFor(() => expect(view.container.textContent).toContain('FRESH RESULT'));
            removeHook(HOOKS['post.title.filter'], 'same-id-refetch');
        });

        it('serializes async before/after actions for one render generation', async () => {
            const { addAction, HOOKS, removeHook } = await import('../hooks');
            const sequence: string[] = [];
            let releaseBefore!: () => void;
            const beforeGate = new Promise<void>((resolve) => {
                releaseBefore = resolve;
            });
            addAction(
                HOOKS['post.render.before'],
                async () => {
                    sequence.push('before:start');
                    await beforeGate;
                    sequence.push('before:end');
                },
                undefined,
                'async-render-before',
            );
            addAction(
                HOOKS['post.render.after'],
                () => {
                    sequence.push('after');
                },
                undefined,
                'async-render-after',
            );

            const view = render(<BlogRenderer post={createMockPost()} />);
            await waitFor(() => expect(sequence).toEqual(['before:start']));
            view.unmount();
            expect(sequence).toEqual(['before:start']);

            await act(async () => releaseBefore());
            await waitFor(() => expect(sequence).toEqual(['before:start', 'before:end', 'after']));
            removeHook(HOOKS['post.render.before'], 'async-render-before');
            removeHook(HOOKS['post.render.after'], 'async-render-after');
        });

        it('uses a compact photo collage in listing cards', async () => {
            const journal = createMockPost({
                contentType: 'photo',
                photoAlbum: [
                    { id: 'p1', url: 'https://images.test/one.jpg' },
                    { id: 'p2', url: 'https://images.test/two.jpg' },
                ],
                content: null,
            });
            const { container } = render(<BlogExcerptCard post={journal} />);
            await waitFor(() => expect(container.querySelector('.blog-photo-journal--timeline')).toBeTruthy());
            expect(container.textContent).toContain('Photo journal · 2 frames');
        });

        it('should handle empty content blocks without crashing', async () => {
            const emptyPost = createMockPost();
            const { container } = render(<BlogRenderer post={emptyPost} />);

            // Wait for async filtering to complete
            await waitFor(
                () => {
                    // Component should render without crashing
                    expect(container.firstChild).toBeTruthy();
                },
                { timeout: 3000 },
            );
        });

        it('should handle posts with missing optional fields', async () => {
            const minimalPost = createMockPost({
                author: undefined,
                excerpt: undefined,
            });

            const { container } = render(<BlogRenderer post={minimalPost} />);

            await waitFor(
                () => {
                    expect(container.firstChild).toBeTruthy();
                },
                { timeout: 3000 },
            );
        });
    });

    describe('Props handling', () => {
        it('should accept showExcerpt prop', async () => {
            const post = createMockPost();
            const { container } = render(<BlogRenderer post={post} showExcerpt />);

            await waitFor(
                () => {
                    expect(container.firstChild).toBeTruthy();
                },
                { timeout: 3000 },
            );
        });

        it('should accept showHeroImage prop', async () => {
            const post = createMockPost({
                heroImage: {
                    url: 'https://example.com/image.jpg',
                    alt: 'Test image',
                },
            });
            const { container } = render(<BlogRenderer post={post} showHeroImage />);

            await waitFor(
                () => {
                    expect(container.firstChild).toBeTruthy();
                },
                { timeout: 3000 },
            );
        });

        it('should render hero image with maxHeight applied', async () => {
            const post = createMockPost({
                heroImage: {
                    url: 'https://example.com/image.jpg',
                    alt: 'Test image',
                    maxHeight: 400,
                },
            });
            const { container } = render(<BlogRenderer post={post} showHeroImage />);

            await waitFor(
                () => {
                    // The cap belongs to the image FRAME, not the <figure>: the figure also wraps
                    // the caption, so capping it there would squeeze the caption out of view.
                    const frame = container.querySelector('figure > div');
                    expect(frame).toBeTruthy();
                    expect((frame as HTMLElement).style.maxHeight).toBe('400px');
                    // An author-set height replaces the default ratio rather than fighting it.
                    expect(frame?.className).not.toContain('aspect-[16/9]');
                },
                { timeout: 3000 },
            );
        });

        it('reserves hero space with a fixed ratio when the author sets no height', async () => {
            const post = createMockPost({
                heroImage: { url: 'https://example.com/image.jpg', alt: 'Test image' },
            });
            const { container } = render(<BlogRenderer post={post} showHeroImage />);

            await waitFor(
                () => {
                    // No ratio means the article reflows as the hero loads.
                    const frame = container.querySelector('figure > div');
                    expect(frame?.className).toContain('aspect-[16/9]');
                },
                { timeout: 3000 },
            );
        });

        it('opens with the masthead and places the hero after it', async () => {
            const post = createMockPost({
                title: 'A considered headline',
                readingTimeMinutes: 6,
                heroImage: { url: 'https://example.com/image.jpg', alt: 'Test image' },
            });
            const { container } = render(<BlogRenderer post={post} showHeroImage showTitle showMetadata />);

            await waitFor(
                () => {
                    const heading = container.querySelector('h1');
                    const figure = container.querySelector('figure');
                    expect(heading).toBeTruthy();
                    expect(figure).toBeTruthy();
                    expect(heading!.textContent).toBe('A considered headline');
                    // A feature opens with its headline; the image illustrates it.
                    const position = heading!.compareDocumentPosition(figure!);
                    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
                    // The eyebrow carries what this is and how long it takes.
                    expect(container.textContent).toContain('6 min read');
                },
                { timeout: 3000 },
            );
        });

        it('should accept showMetadata prop', async () => {
            const post = createMockPost();
            const { container } = render(<BlogRenderer post={post} showMetadata />);

            await waitFor(
                () => {
                    expect(container.firstChild).toBeTruthy();
                },
                { timeout: 3000 },
            );
        });

        it('should accept showFootnotes prop', async () => {
            const post = createMockPost({
                footnotes: {
                    time: Date.now(),
                    blocks: [{ type: 'paragraph', data: { text: 'Footnote text' } }],
                    version: '2.28.0',
                },
            });
            const { container } = render(<BlogRenderer post={post} showFootnotes />);

            await waitFor(
                () => {
                    expect(container.firstChild).toBeTruthy();
                },
                { timeout: 3000 },
            );
        });

        it('should accept custom themeId prop', async () => {
            const post = createMockPost();
            const { container } = render(<BlogRenderer post={post} themeId="minimal" />);

            await waitFor(
                () => {
                    expect(container.firstChild).toBeTruthy();
                },
                { timeout: 3000 },
            );
        });

        it('should accept multiple props together', async () => {
            const post = createMockPost();
            const { container } = render(
                <BlogRenderer post={post} showExcerpt showMetadata showHeroImage showFootnotes />,
            );

            await waitFor(
                () => {
                    expect(container.firstChild).toBeTruthy();
                },
                { timeout: 3000 },
            );
        });
    });

    describe('Error resilience', () => {
        it('should handle different content types', async () => {
            const contentTypes = ['blog', 'blurb', 'photo', 'news', 'docs', 'changelog', 'announcement'];

            for (const contentType of contentTypes) {
                const post = createMockPost({ contentType: contentType as any });
                const { container, unmount } = render(<BlogRenderer post={post} />);

                await waitFor(
                    () => {
                        expect(container.firstChild).toBeTruthy();
                    },
                    { timeout: 3000 },
                );

                unmount();
            }
        });
    });

    describe('Re-rendering behavior', () => {
        it('should update when post prop changes', async () => {
            const post1 = createMockPost({ title: 'First Title' });
            const { container, rerender } = render(<BlogRenderer post={post1} />);

            await waitFor(
                () => {
                    expect(container.firstChild).toBeTruthy();
                },
                { timeout: 3000 },
            );

            const post2 = createMockPost({ title: 'Second Title' });
            rerender(<BlogRenderer post={post2} />);

            await waitFor(
                () => {
                    expect(container.firstChild).toBeTruthy();
                },
                { timeout: 3000 },
            );
        });

        it('should update when props change', async () => {
            const post = createMockPost();
            const { container, rerender } = render(<BlogRenderer post={post} showExcerpt={false} />);

            await waitFor(
                () => {
                    expect(container.firstChild).toBeTruthy();
                },
                { timeout: 3000 },
            );

            rerender(<BlogRenderer post={post} showExcerpt={true} />);

            await waitFor(
                () => {
                    expect(container.firstChild).toBeTruthy();
                },
                { timeout: 3000 },
            );
        });
    });
});
