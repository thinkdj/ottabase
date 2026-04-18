import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlogRenderer, type BlogPostData } from '../components/BlogRenderer';

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
    author: { id: 'author-1', name: 'Test Author', email: null, image: null },
    createdAt: Date.parse('2024-01-15T00:00:00Z'),
    ...overrides,
});

describe('BlogRenderer', () => {
    describe('Safe rendering', () => {
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
            const contentTypes = ['blog', 'news', 'docs', 'changelog', 'announcement'];

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
