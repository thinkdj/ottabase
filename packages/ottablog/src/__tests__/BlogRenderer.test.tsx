import { render, waitFor } from '@testing-library/react';
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

        it('uses the compact blurb renderer in listing cards', () => {
            const blurb = createMockPost({ contentType: 'blurb', blurbText: 'A passing thought', content: null });
            const { container } = render(<BlogExcerptCard post={blurb} />);
            expect(container.querySelector('.blog-blurb--timeline')).toBeTruthy();
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

        it('uses a compact photo collage in listing cards', () => {
            const journal = createMockPost({
                contentType: 'photo',
                photoAlbum: [
                    { id: 'p1', url: 'https://images.test/one.jpg' },
                    { id: 'p2', url: 'https://images.test/two.jpg' },
                ],
                content: null,
            });
            const { container } = render(<BlogExcerptCard post={journal} />);
            expect(container.querySelector('.blog-photo-journal--timeline')).toBeTruthy();
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
                    const figure = container.querySelector('figure');
                    expect(figure).toBeTruthy();
                    // maxHeight is applied as inline style on the figure
                    expect(figure?.style.maxHeight).toBe('400px');
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
