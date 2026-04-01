import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import React from 'react';
import Testimonial from './Testimonial';

describe('Testimonial Renderer', () => {
    // ── Null / empty guards ────────────────────────────────────────────────────

    it('should render null for undefined data', () => {
        const { container } = render(<Testimonial data={undefined as any} />);
        expect(container.firstChild).toBeNull();
    });

    it('should render null when quote is empty', () => {
        const { container } = render(<Testimonial data={{ quote: '', authorName: 'Alice', variant: 'card' }} />);
        expect(container.firstChild).toBeNull();
    });

    it('should render null when authorName is empty', () => {
        const { container } = render(<Testimonial data={{ quote: 'Great!', authorName: '', variant: 'card' }} />);
        expect(container.firstChild).toBeNull();
    });

    // ── Card variant ────────────────────────────────────────────────────────────

    describe('Card variant', () => {
        const baseData = {
            quote: 'This product is amazing.',
            authorName: 'Jane Doe',
            authorRole: 'CTO',
            authorCompany: 'Techcorp',
            variant: 'card' as const,
        };

        it('should render the quote text', () => {
            render(<Testimonial data={baseData} />);
            expect(screen.getByText('This product is amazing.')).toBeTruthy();
        });

        it('should render author name', () => {
            render(<Testimonial data={baseData} />);
            expect(screen.getByText('Jane Doe')).toBeTruthy();
        });

        it('should render role and company separated by ·', () => {
            render(<Testimonial data={baseData} />);
            expect(screen.getByText('CTO · Techcorp')).toBeTruthy();
        });

        it('should render the card wrapper with cdc-testimonial-card class', () => {
            const { container } = render(<Testimonial data={baseData} />);
            expect(container.querySelector('.cdc-testimonial-card')).toBeTruthy();
        });

        it('should render avatar when provided', () => {
            render(<Testimonial data={{ ...baseData, authorAvatar: 'https://cdn.example.com/jane.jpg' }} />);
            const img = screen.getByRole('img', { name: 'Jane Doe' });
            expect(img.getAttribute('src')).toBe('https://cdn.example.com/jane.jpg');
        });

        it('should NOT render avatar when not provided', () => {
            const { container } = render(<Testimonial data={baseData} />);
            expect(container.querySelector('.cdc-testimonial-avatar')).toBeNull();
        });

        it('should render company logo when provided', () => {
            const { container } = render(
                <Testimonial data={{ ...baseData, companyLogo: 'https://cdn.example.com/logo.png' }} />,
            );
            expect(container.querySelector('.cdc-testimonial-company-logo')).toBeTruthy();
        });
    });

    // ── Star rating ────────────────────────────────────────────────────────────

    describe('Star rating', () => {
        it('should render stars when rating is provided', () => {
            const { container } = render(
                <Testimonial data={{ quote: 'Great!', authorName: 'Bob', rating: 4, variant: 'card' }} />,
            );
            expect(container.querySelector('.cdc-testimonial-stars')).toBeTruthy();
        });

        it('should not render stars when rating is 0 or absent', () => {
            const { container } = render(
                <Testimonial data={{ quote: 'Good.', authorName: 'Charlie', variant: 'card' }} />,
            );
            expect(container.querySelector('.cdc-testimonial-stars')).toBeNull();
        });

        it('should mark correct number of filled stars', () => {
            const { container } = render(
                <Testimonial data={{ quote: 'Nice!', authorName: 'Dana', rating: 3, variant: 'card' }} />,
            );
            const filled = container.querySelectorAll('.cdc-testimonial-star--filled');
            expect(filled).toHaveLength(3);
        });

        it('should clamp rating to 5', () => {
            const { container } = render(
                <Testimonial data={{ quote: 'Perfect!', authorName: 'Eve', rating: 10, variant: 'card' }} />,
            );
            const filled = container.querySelectorAll('.cdc-testimonial-star--filled');
            expect(filled).toHaveLength(5);
        });
    });

    // ── Minimal variant ─────────────────────────────────────────────────────────

    describe('Minimal variant', () => {
        it('should render with cdc-testimonial-minimal class', () => {
            const { container } = render(
                <Testimonial data={{ quote: 'Minimal works.', authorName: 'Frank', variant: 'minimal' }} />,
            );
            expect(container.querySelector('.cdc-testimonial-minimal')).toBeTruthy();
        });

        it('should NOT render card class in minimal variant', () => {
            const { container } = render(
                <Testimonial data={{ quote: 'Minimal.', authorName: 'George', variant: 'minimal' }} />,
            );
            expect(container.querySelector('.cdc-testimonial-card')).toBeNull();
        });
    });

    // ── Featured variant ─────────────────────────────────────────────────────────

    describe('Featured variant', () => {
        it('should render with cdc-testimonial-featured class', () => {
            const { container } = render(
                <Testimonial data={{ quote: 'Featured is large.', authorName: 'Hannah', variant: 'featured' }} />,
            );
            expect(container.querySelector('.cdc-testimonial-featured')).toBeTruthy();
        });

        it('should render the large quote class', () => {
            const { container } = render(
                <Testimonial data={{ quote: 'Big quote.', authorName: 'Ivan', variant: 'featured' }} />,
            );
            expect(container.querySelector('.cdc-testimonial-quote--large')).toBeTruthy();
        });
    });

    // ── Structured data ────────────────────────────────────────────────────────

    describe('Review structured data', () => {
        it('should emit ld+json when rating is provided', () => {
            const { container } = render(
                <Testimonial data={{ quote: 'Excellent.', authorName: 'Jane', rating: 5, variant: 'card' }} />,
            );
            const script = container.querySelector('script[type="application/ld+json"]');
            expect(script).toBeTruthy();
            const json = JSON.parse(script!.innerHTML);
            expect(json['@type']).toBe('Review');
            expect(json.reviewRating.ratingValue).toBe(5);
        });

        it('should NOT emit ld+json when no rating is provided', () => {
            const { container } = render(<Testimonial data={{ quote: 'Good.', authorName: 'Bob', variant: 'card' }} />);
            const script = container.querySelector('script[type="application/ld+json"]');
            expect(script).toBeNull();
        });
    });

    // ── className passthrough ──────────────────────────────────────────────────

    it('should apply extra className to the figure', () => {
        const { container } = render(
            <Testimonial data={{ quote: 'Yep!', authorName: 'Kim', variant: 'card' }} className="custom-class" />,
        );
        const figure = container.querySelector('figure');
        expect(figure?.className).toContain('custom-class');
    });
});
