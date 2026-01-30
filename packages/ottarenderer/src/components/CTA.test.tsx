import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CTA from './CTA';

describe('CTA Renderer', () => {
    describe('Basic Rendering', () => {
        it('should render CTA button with default values', () => {
            render(<CTA data={{}} />);
            const link = screen.getByRole('link', { name: /get started/i });
            expect(link).toBeTruthy();
            expect(link.getAttribute('href')).toBe('#');
        });

        it('should render with custom text', () => {
            render(<CTA data={{ text: 'Sign Up Now' }} />);
            expect(screen.getByRole('link', { name: /sign up now/i })).toBeTruthy();
        });

        it('should render with custom URL', () => {
            render(<CTA data={{ url: 'https://example.com' }} />);
            const link = screen.getByRole('link');
            expect(link.getAttribute('href')).toBe('https://example.com');
        });
    });

    describe('Button Styles', () => {
        it('should apply primary style by default', () => {
            const { container } = render(<CTA data={{ text: 'Button' }} />);
            const link = container.querySelector('a');
            expect(link?.className).toContain('bg-blue-600');
        });

        it('should apply primary style when specified', () => {
            const { container } = render(<CTA data={{ text: 'Button', style: 'primary' }} />);
            const link = container.querySelector('a');
            expect(link?.className).toContain('bg-blue-600');
        });

        it('should apply secondary style', () => {
            const { container } = render(<CTA data={{ text: 'Button', style: 'secondary' }} />);
            const link = container.querySelector('a');
            expect(link?.className).toContain('bg-gray-600');
        });

        it('should apply outline style', () => {
            const { container } = render(<CTA data={{ text: 'Button', style: 'outline' }} />);
            const link = container.querySelector('a');
            expect(link?.className).toContain('bg-transparent');
            expect(link?.className).toContain('border-2');
        });
    });

    describe('Link Attributes', () => {
        it('should open in same tab by default', () => {
            render(<CTA data={{ url: 'https://example.com' }} />);
            const link = screen.getByRole('link');
            expect(link.getAttribute('target')).toBe('_self');
            expect(link.getAttribute('rel')).toBe('');
        });

        it('should open in new tab when specified', () => {
            render(<CTA data={{ url: 'https://example.com', openInNewTab: true }} />);
            const link = screen.getByRole('link');
            expect(link.getAttribute('target')).toBe('_blank');
            expect(link.getAttribute('rel')).toBe('noopener noreferrer');
        });
    });

    describe('SEO Features', () => {
        it('should include structured data for valid URLs', () => {
            const { container } = render(<CTA data={{ text: 'Get Started', url: 'https://example.com' }} />);
            const script = container.querySelector('script[type="application/ld+json"]');
            expect(script).toBeTruthy();

            if (script) {
                const data = JSON.parse(script.textContent || '{}');
                expect(data['@type']).toBe('Action');
                expect(data.name).toBe('Get Started');
                expect(data.target.urlTemplate).toBe('https://example.com');
            }
        });

        it('should not include structured data for placeholder URLs', () => {
            const { container } = render(<CTA data={{ url: '#' }} />);
            const script = container.querySelector('script[type="application/ld+json"]');
            expect(script).toBeFalsy();
        });

        it('should include microdata attributes', () => {
            render(<CTA data={{ text: 'Button', url: 'https://example.com' }} />);
            const link = screen.getByRole('link');
            expect(link.getAttribute('itemScope')).toBe('');
            expect(link.getAttribute('itemType')).toBe('https://schema.org/Action');
            expect(link.getAttribute('itemProp')).toBe('name');
        });

        it('should include noscript fallback', () => {
            const { container } = render(<CTA data={{ text: 'Button', url: 'https://example.com' }} />);
            // Note: React Testing Library doesn't render noscript tags, but they exist in the HTML
            // This test verifies the component structure includes noscript
            const html = container.innerHTML;
            expect(html).toContain('noscript');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-label', () => {
            render(<CTA data={{ text: 'Sign Up' }} />);
            const link = screen.getByRole('link');
            expect(link.getAttribute('aria-label')).toBe('Sign Up');
        });

        it('should have focus styles', () => {
            const { container } = render(<CTA data={{ text: 'Button' }} />);
            const link = container.querySelector('a');
            expect(link?.className).toContain('focus:outline-none');
            expect(link?.className).toContain('focus:ring-2');
        });
    });

    describe('Icon Support', () => {
        it('should render icon when provided', () => {
            const { container } = render(<CTA data={{ text: 'Button', icon: '<svg>icon</svg>' }} />);
            const iconSpan = container.querySelector("span[aria-hidden='true']");
            expect(iconSpan).toBeTruthy();
            expect(iconSpan?.innerHTML).toBe('<svg>icon</svg>');
        });

        it('should not render icon when not provided', () => {
            const { container } = render(<CTA data={{ text: 'Button' }} />);
            const iconSpan = container.querySelector("span[aria-hidden='true']");
            expect(iconSpan).toBeFalsy();
        });
    });

    describe('Custom ClassName', () => {
        it('should apply custom className', () => {
            const { container } = render(<CTA data={{ text: 'Button' }} className="custom-class" />);
            const wrapper = container.querySelector('.custom-class');
            expect(wrapper).toBeTruthy();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty text gracefully', () => {
            render(<CTA data={{ text: '' }} />);
            expect(screen.getByRole('link', { name: /get started/i })).toBeTruthy();
        });

        it('should handle missing URL gracefully', () => {
            render(<CTA data={{ text: 'Button', url: undefined }} />);
            const link = screen.getByRole('link');
            expect(link.getAttribute('href')).toBe('#');
        });

        it('should handle invalid style gracefully', () => {
            const { container } = render(<CTA data={{ text: 'Button', style: 'invalid' as any }} />);
            const link = container.querySelector('a');
            expect(link).toBeTruthy();
        });
    });
});
