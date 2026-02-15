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
            expect(screen.getByText('4.5/5')).toBeTruthy();
        });

        it('should not render rating when zero', () => {
            const { container } = render(<Review data={{ title: 'Test', rating: 0 }} />);
            expect(container.querySelector('[role="img"]')).toBeFalsy();
        });

        it('should render correct number of stars for maxStars=10', () => {
            render(<Review data={{ title: 'Test', rating: 7, maxStars: 10 }} />);
            expect(screen.getByText('7/10')).toBeTruthy();
        });

        it('should have aria-label for accessibility', () => {
            render(<Review data={{ title: 'Test', rating: 4, maxStars: 5 }} />);
            const ratingDiv = screen.getByRole('img');
            expect(ratingDiv.getAttribute('aria-label')).toBe('Rating: 4 out of 5 stars');
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
            expect(screen.getByText('Verdict:')).toBeTruthy();
        });

        it('should not render summary when not provided', () => {
            const { container } = render(<Review data={{ title: 'Test' }} />);
            expect(container.querySelector('.border-t')).toBeFalsy();
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
            expect(screen.getByText('4.5/5')).toBeTruthy();
            expect(screen.getByText('Great overall.')).toBeTruthy();
        });
    });
});
