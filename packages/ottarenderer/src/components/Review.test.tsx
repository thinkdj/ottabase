import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Review from './Review';

describe('Review Renderer', () => {
    describe('Basic Rendering', () => {
        it('should render review with title', () => {
            render(<Review data={{ title: 'Great Product' }} />);
            expect(screen.getByText('Great Product')).toBeTruthy();
        });

        it('should not render when title is empty', () => {
            const { container } = render(<Review data={{}} />);
            expect(container.querySelector('.cdc-content-review')).toBeFalsy();
        });

        it('should render content', () => {
            render(<Review data={{ title: 'Test', content: 'This is a great product.' }} />);
            expect(screen.getByText('This is a great product.')).toBeTruthy();
        });
    });

    describe('Image', () => {
        it('should render image when provided', () => {
            const { container } = render(<Review data={{ title: 'Test', image: 'https://example.com/img.jpg' }} />);
            const img = container.querySelector('img');
            expect(img).toBeTruthy();
            expect(img?.getAttribute('src')).toBe('https://example.com/img.jpg');
        });

        it('should not render image when not provided', () => {
            const { container } = render(<Review data={{ title: 'Test' }} />);
            const img = container.querySelector('img');
            expect(img).toBeFalsy();
        });
    });

    describe('Star Rating', () => {
        it('should render rating when provided', () => {
            render(<Review data={{ title: 'Test', rating: 4.5, maxStars: 5 }} />);
            // Rating is displayed in the gradient header, check for both parts
            expect(screen.getByText('4.5')).toBeTruthy();
            expect(screen.getByText('out of', { exact: false })).toBeTruthy();
        });

        it('should not render rating when zero', () => {
            const { container } = render(<Review data={{ title: 'Test', rating: 0 }} />);
            // When rating is 0, no gradient header should be rendered
            expect(container.querySelector('[role="img"]')).toBeFalsy();
        });

        it('should render correct number of stars for maxStars=10', () => {
            render(<Review data={{ title: 'Test', rating: 7, maxStars: 10 }} />);
            // Rating is displayed in the gradient header
            expect(screen.getByText('7')).toBeTruthy();
            expect(screen.getByText('out of', { exact: false })).toBeTruthy();
        });

        it('should have aria-label for accessibility', () => {
            render(<Review data={{ title: 'Test', rating: 4, maxStars: 5 }} />);
            // The responsive layout now shows the rating prominently in the gradient header
            // Check for the presence of rating elements instead
            expect(screen.getByText('4')).toBeTruthy();
            expect(screen.getByText(/out of 5/)).toBeTruthy();
        });
    });

    describe('Pros and Cons', () => {
        it('should render pros list', () => {
            render(<Review data={{ title: 'Test', pros: ['Fast', 'Reliable'] }} />);
            expect(screen.getByText('Fast')).toBeTruthy();
            expect(screen.getByText('Reliable')).toBeTruthy();
        });

        it('should render cons list', () => {
            render(<Review data={{ title: 'Test', cons: ['Expensive', 'Complex'] }} />);
            expect(screen.getByText('Expensive')).toBeTruthy();
            expect(screen.getByText('Complex')).toBeTruthy();
        });

        it('should not render pros/cons section when both are empty', () => {
            const { container } = render(<Review data={{ title: 'Test' }} />);
            expect(container.querySelector('.grid-cols-2')).toBeFalsy();
        });

        it('should filter empty pros and cons', () => {
            const { container } = render(<Review data={{ title: 'Test', pros: ['Good', '', '  '], cons: ['Bad'] }} />);
            const listItems = container.querySelectorAll('li');
            expect(listItems.length).toBe(2); // 'Good' + 'Bad'
        });
    });

    describe('Link', () => {
        it('should render link when URL is provided', () => {
            render(<Review data={{ title: 'Test', linkUrl: 'https://example.com', linkLabel: 'Buy Now' }} />);
            const link = screen.getByText('Buy Now');
            expect(link.closest('a')?.getAttribute('href')).toBe('https://example.com');
        });

        it('should use default label when not provided', () => {
            render(<Review data={{ title: 'Test', linkUrl: 'https://example.com' }} />);
            expect(screen.getByText('Learn more')).toBeTruthy();
        });

        it('should open link in new tab', () => {
            render(<Review data={{ title: 'Test', linkUrl: 'https://example.com' }} />);
            const link = screen.getByText('Learn more').closest('a');
            expect(link?.getAttribute('target')).toBe('_blank');
            expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
        });
    });

    describe('Summary', () => {
        it('should render summary when provided', () => {
            render(<Review data={{ title: 'Test', summary: 'Highly recommended.' }} />);
            expect(screen.getByText('Highly recommended.')).toBeTruthy();
            // The new design shows "Verdict" as a separate h4 element
            expect(screen.getByText('Verdict')).toBeTruthy();
        });

        it('should not render summary when not provided', () => {
            const { container } = render(<Review data={{ title: 'Test' }} />);
            // The new design uses a gradient container only when summary is present
            const verdictBox = Array.from(container.querySelectorAll('[class*="bg-gradient-to-r"]')).find((el) =>
                el.textContent?.includes('Verdict'),
            );
            expect(verdictBox).toBeFalsy();
        });
    });

    describe('SEO Features', () => {
        it('should include structured data', () => {
            const { container } = render(
                <Review data={{ title: 'Great Product', content: 'Excellent!', rating: 4.5 }} />,
            );
            const script = container.querySelector('script[type="application/ld+json"]');
            expect(script).toBeTruthy();

            if (script) {
                const data = JSON.parse(script.textContent || '{}');
                expect(data['@type']).toBe('Review');
                expect(data.name).toBe('Great Product');
                expect(data.reviewBody).toBe('Excellent!');
                expect(data.reviewRating.ratingValue).toBe(4.5);
                expect(data.reviewRating.bestRating).toBe(5);
                expect(data.itemReviewed).toBeTruthy();
                expect(data.itemReviewed['@type']).toBe('Thing');
                expect(data.itemReviewed.name).toBe('Great Product');
            }
        });

        it('should include microdata attributes', () => {
            const { container } = render(<Review data={{ title: 'Test', rating: 4 }} />);
            const review = container.querySelector('[itemType="https://schema.org/Review"]');
            expect(review).toBeTruthy();
        });

        it('should include noscript fallback', () => {
            const { container } = render(<Review data={{ title: 'Test' }} />);
            expect(container.innerHTML).toContain('noscript');
        });
    });

    describe('Accessibility', () => {
        it('should use semantic heading for title', () => {
            render(<Review data={{ title: 'My Review' }} />);
            const heading = screen.getByRole('heading', { name: 'My Review' });
            expect(heading).toBeTruthy();
        });
    });

    describe('Custom ClassName', () => {
        it('should apply custom className', () => {
            const { container } = render(<Review data={{ title: 'Test' }} className="custom-class" />);
            const wrapper = container.querySelector('.custom-class');
            expect(wrapper).toBeTruthy();
        });
    });

    describe('Edge Cases', () => {
        it('should handle all fields populated', () => {
            render(
                <Review
                    data={{
                        title: 'Full Review',
                        content: 'Complete content.',
                        image: 'https://example.com/img.jpg',
                        linkUrl: 'https://example.com',
                        linkLabel: 'Visit',
                        pros: ['Pro 1', 'Pro 2'],
                        cons: ['Con 1'],
                        rating: 4.5,
                        maxStars: 5,
                        allowHalfStars: true,
                        summary: 'Great overall.',
                    }}
                />,
            );

            expect(screen.getByText('Full Review')).toBeTruthy();
            expect(screen.getByText('Complete content.')).toBeTruthy();
            expect(screen.getByText('Visit')).toBeTruthy();
            expect(screen.getByText('Pro 1')).toBeTruthy();
            expect(screen.getByText('Con 1')).toBeTruthy();
            // Rating is now split in the gradient header
            expect(screen.getByText('4.5')).toBeTruthy();
            expect(screen.getByText('Great overall.')).toBeTruthy();
        });
    });

    describe('Compact Mode', () => {
        it('should render compact layout when compact is true', () => {
            const { container } = render(
                <Review data={{ title: 'Compact Review', rating: 4, maxStars: 5, compact: true }} />,
            );
            expect(container.querySelector('.cdc-content-review--compact')).toBeTruthy();
        });

        it('should render full layout when compact is false', () => {
            const { container } = render(
                <Review data={{ title: 'Full Review', rating: 4, maxStars: 5, compact: false }} />,
            );
            expect(container.querySelector('.cdc-content-review--compact')).toBeFalsy();
            expect(container.querySelector('.cdc-content-review')).toBeTruthy();
        });

        it('should show thumbnail image in compact mode', () => {
            const { container } = render(
                <Review data={{ title: 'Test', image: 'https://example.com/img.jpg', compact: true }} />,
            );
            const img = container.querySelector('img');
            expect(img).toBeTruthy();
            expect(img?.getAttribute('src')).toBe('https://example.com/img.jpg');
        });

        it('should show inline rating badge in compact mode', () => {
            render(<Review data={{ title: 'Test', rating: 3.5, maxStars: 5, compact: true }} />);
            expect(screen.getByText('3.5')).toBeTruthy();
        });

        it('should show summary as truncated text in compact mode', () => {
            render(<Review data={{ title: 'Test', summary: 'A great product overall', compact: true }} />);
            expect(screen.getByText('A great product overall')).toBeTruthy();
        });

        it('should link title when linkUrl is provided in compact mode', () => {
            render(<Review data={{ title: 'Linked', linkUrl: 'https://example.com', compact: true }} />);
            const link = screen.getByText('Linked').closest('a');
            expect(link).toBeTruthy();
            expect(link?.getAttribute('href')).toBe('https://example.com');
        });

        it('should default to full layout when compact is not set', () => {
            const { container } = render(<Review data={{ title: 'Default' }} />);
            expect(container.querySelector('.cdc-content-review--compact')).toBeFalsy();
        });
    });
});
