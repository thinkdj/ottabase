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

    describe('Button Styles (theme token classes)', () => {
        it('should apply primary style by default', () => {
            const { container } = render(<CTA data={{ text: 'Button' }} />);
            const link = container.querySelector('a');
            expect(link?.className).toContain('bg-primary');
            expect(link?.className).toContain('text-primary-foreground');
        });

        it('should apply secondary style', () => {
            const { container } = render(<CTA data={{ text: 'Button', style: 'secondary' }} />);
            const link = container.querySelector('a');
            expect(link?.className).toContain('bg-secondary');
            expect(link?.className).toContain('text-secondary-foreground');
        });

        it('should apply outline style', () => {
            const { container } = render(<CTA data={{ text: 'Button', style: 'outline' }} />);
            const link = container.querySelector('a');
            expect(link?.className).toContain('bg-transparent');
            expect(link?.className).toContain('text-primary');
        });

        it('should apply ghost style', () => {
            const { container } = render(<CTA data={{ text: 'Button', style: 'ghost' }} />);
            const link = container.querySelector('a');
            expect(link?.className).toContain('bg-transparent');
            expect(link?.className).toContain('text-foreground');
            expect(link?.className).toContain('border-border');
        });
    });

    describe('Alignment', () => {
        it('should default to center alignment', () => {
            const { container } = render(<CTA data={{ text: 'Button' }} />);
            const wrapper = container.querySelector('[data-alignment]');
            expect(wrapper?.getAttribute('data-alignment')).toBe('center');
            expect(wrapper?.className).toContain('justify-center');
        });

        it('should apply left alignment', () => {
            const { container } = render(<CTA data={{ text: 'Button', alignment: 'left' }} />);
            const wrapper = container.querySelector('[data-alignment]');
            expect(wrapper?.getAttribute('data-alignment')).toBe('left');
            expect(wrapper?.className).toContain('justify-start');
        });

        it('should apply right alignment', () => {
            const { container } = render(<CTA data={{ text: 'Button', alignment: 'right' }} />);
            const wrapper = container.querySelector('[data-alignment]');
            expect(wrapper?.getAttribute('data-alignment')).toBe('right');
            expect(wrapper?.className).toContain('justify-end');
        });
    });

    describe('Link Attributes', () => {
        it('should open in same tab by default', () => {
            render(<CTA data={{ url: 'https://example.com' }} />);
            const link = screen.getByRole('link');
            expect(link.getAttribute('target')).toBe('_self');
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
        it('should apply custom className to wrapper', () => {
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

        it('should handle invalid style gracefully by using primary fallback', () => {
            const { container } = render(<CTA data={{ text: 'Button', style: 'invalid' as any }} />);
            const link = container.querySelector('a');
            // Falls back to primary
            expect(link?.className).toContain('bg-primary');
        });
    });
});
