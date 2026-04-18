import { beforeEach, describe, expect, it, vi } from 'vitest';
import TestimonialTool, { type TestimonialData } from '../TestimonialTool';

// Mock CSS import
vi.mock('../TestimonialTool.css', () => ({}));

const createMockAPI = () => ({
    blocks: {
        getCurrentBlockIndex: vi.fn(() => 0),
    },
});

describe('TestimonialTool', () => {
    let mockAPI: ReturnType<typeof createMockAPI>;

    beforeEach(() => {
        mockAPI = createMockAPI();
    });

    // ── Static metadata ──────────────────────────────────────────────────────

    describe('Toolbox', () => {
        it('should have correct toolbox title and icon', () => {
            expect(TestimonialTool.toolbox.title).toBe('Testimonial');
            expect(TestimonialTool.toolbox.icon).toContain('svg');
        });
    });

    describe('enableLineBreaks', () => {
        it('should allow line breaks in the quote', () => {
            expect(TestimonialTool.enableLineBreaks).toBe(true);
        });
    });

    // ── Constructor defaults ────────────────────────────────────────────────

    describe('Constructor defaults', () => {
        it('should default to card variant with empty fields', () => {
            const tool = new TestimonialTool({ api: mockAPI as any, config: {} });
            const saved = tool.save();
            expect(saved.variant).toBe('card');
            expect(saved.quote).toBe('');
            expect(saved.authorName).toBe('');
        });

        it('should accept defaultVariant from config', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: { defaultVariant: 'featured' },
            });
            expect(tool.save().variant).toBe('featured');
        });

        it('should preserve all provided data', () => {
            const initialData: TestimonialData = {
                quote: 'This product changed my life.',
                authorName: 'Alice',
                authorRole: 'CTO',
                authorCompany: 'Techcorp',
                authorAvatar: 'https://cdn.example.com/alice.jpg',
                companyLogo: 'https://cdn.example.com/logo.png',
                rating: 5,
                variant: 'featured',
            };
            const tool = new TestimonialTool({ api: mockAPI as any, config: {}, data: initialData });
            const saved = tool.save();
            expect(saved.quote).toBe(initialData.quote);
            expect(saved.authorName).toBe(initialData.authorName);
            expect(saved.authorRole).toBe(initialData.authorRole);
            expect(saved.authorCompany).toBe(initialData.authorCompany);
            expect(saved.authorAvatar).toBe(initialData.authorAvatar);
            expect(saved.companyLogo).toBe(initialData.companyLogo);
            expect(saved.rating).toBe(5);
            expect(saved.variant).toBe('featured');
        });
    });

    // ── save() ────────────────────────────────────────────────────────────────

    describe('save()', () => {
        it('should trim whitespace from all string fields', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: '  Great product!  ',
                    authorName: '  Bob  ',
                    authorRole: '  CEO  ',
                    authorCompany: '  ACME  ',
                    variant: 'card',
                },
            });
            const saved = tool.save();
            expect(saved.quote).toBe('Great product!');
            expect(saved.authorName).toBe('Bob');
            expect(saved.authorRole).toBe('CEO');
            expect(saved.authorCompany).toBe('ACME');
        });

        it('should set optional empty fields to undefined', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Good.',
                    authorName: 'Alice',
                    authorRole: '',
                    authorCompany: '',
                    authorAvatar: '',
                    companyLogo: '',
                    variant: 'minimal',
                },
            });
            const saved = tool.save();
            expect(saved.authorRole).toBeUndefined();
            expect(saved.authorCompany).toBeUndefined();
            expect(saved.authorAvatar).toBeUndefined();
            expect(saved.companyLogo).toBeUndefined();
        });

        it('should set rating to undefined when 0', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Decent.',
                    authorName: 'Charlie',
                    rating: 0,
                    variant: 'card',
                },
            });
            expect(tool.save().rating).toBeUndefined();
        });

        it('should include rating when > 0', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Amazing!',
                    authorName: 'Dave',
                    rating: 4,
                    variant: 'card',
                },
            });
            expect(tool.save().rating).toBe(4);
        });
    });

    // ── validate() ───────────────────────────────────────────────────────────

    describe('validate()', () => {
        it('should return true when both quote and authorName are provided', () => {
            const tool = new TestimonialTool({ api: mockAPI as any, config: {} });
            expect(tool.validate({ quote: 'Loved it!', authorName: 'Eve', variant: 'card' })).toBe(true);
        });

        it('should return false when quote is empty', () => {
            const tool = new TestimonialTool({ api: mockAPI as any, config: {} });
            expect(tool.validate({ quote: '', authorName: 'Frank', variant: 'card' })).toBe(false);
        });

        it('should return false when authorName is empty', () => {
            const tool = new TestimonialTool({ api: mockAPI as any, config: {} });
            expect(tool.validate({ quote: 'Great!', authorName: '', variant: 'card' })).toBe(false);
        });

        it('should return false when both quote and authorName are whitespace only', () => {
            const tool = new TestimonialTool({ api: mockAPI as any, config: {} });
            expect(tool.validate({ quote: '   ', authorName: '   ', variant: 'card' })).toBe(false);
        });
    });

    // ── New fields (sourceUrl, verified, new variants) ──────────────────────

    describe('New variants', () => {
        it('should save quote-bubble variant correctly', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Amazing service!',
                    authorName: 'Quinn',
                    variant: 'quote-bubble',
                },
            });
            expect(tool.save().variant).toBe('quote-bubble');
        });

        it('should save side-by-side variant correctly', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Highly recommend.',
                    authorName: 'Riley',
                    variant: 'side-by-side',
                },
            });
            expect(tool.save().variant).toBe('side-by-side');
        });

        it('should accept quote-bubble as defaultVariant from config', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: { defaultVariant: 'quote-bubble' },
            });
            expect(tool.save().variant).toBe('quote-bubble');
        });

        it('should accept side-by-side as defaultVariant from config', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: { defaultVariant: 'side-by-side' },
            });
            expect(tool.save().variant).toBe('side-by-side');
        });
    });

    describe('sourceUrl field', () => {
        it('should save sourceUrl when provided', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Wonderful product.',
                    authorName: 'Sam',
                    sourceUrl: 'https://twitter.com/sam/status/123',
                    variant: 'card',
                },
            });
            expect(tool.save().sourceUrl).toBe('https://twitter.com/sam/status/123');
        });

        it('should trim whitespace from sourceUrl', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Nice!',
                    authorName: 'Tara',
                    sourceUrl: '  https://example.com  ',
                    variant: 'card',
                },
            });
            expect(tool.save().sourceUrl).toBe('https://example.com');
        });

        it('should set sourceUrl to undefined when empty', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Good.',
                    authorName: 'Uma',
                    sourceUrl: '',
                    variant: 'card',
                },
            });
            expect(tool.save().sourceUrl).toBeUndefined();
        });

        it('should default sourceUrl to undefined when not provided', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Fine.',
                    authorName: 'Val',
                    variant: 'card',
                },
            });
            expect(tool.save().sourceUrl).toBeUndefined();
        });
    });

    describe('verified field', () => {
        it('should save verified as true when set', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Verified review.',
                    authorName: 'Wendy',
                    verified: true,
                    variant: 'card',
                },
            });
            expect(tool.save().verified).toBe(true);
        });

        it('should set verified to undefined when false', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Unverified review.',
                    authorName: 'Xander',
                    verified: false,
                    variant: 'card',
                },
            });
            expect(tool.save().verified).toBeUndefined();
        });

        it('should default verified to undefined when not provided', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'No verified field.',
                    authorName: 'Yara',
                    variant: 'card',
                },
            });
            expect(tool.save().verified).toBeUndefined();
        });
    });

    describe('Default values for new fields', () => {
        it('should default all new fields correctly', () => {
            const tool = new TestimonialTool({ api: mockAPI as any, config: {} });
            const saved = tool.save();
            expect(saved.sourceUrl).toBeUndefined();
            expect(saved.verified).toBeUndefined();
            expect(saved.variant).toBe('card');
        });

        it('should preserve all new fields when provided together', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Full data.',
                    authorName: 'Zoe',
                    variant: 'quote-bubble',
                    sourceUrl: 'https://example.com/review',
                    verified: true,
                    rating: 5,
                },
            });
            const saved = tool.save();
            expect(saved.variant).toBe('quote-bubble');
            expect(saved.sourceUrl).toBe('https://example.com/review');
            expect(saved.verified).toBe(true);
            expect(saved.rating).toBe(5);
        });
    });

    // ── DOM rendering ──────────────────────────────────────────────────────────

    describe('render()', () => {
        it('should return an HTMLElement with correct class', () => {
            const tool = new TestimonialTool({ api: mockAPI as any, config: {} });
            const el = tool.render();
            expect(el).toBeInstanceOf(HTMLElement);
            expect(el.classList.contains('cdx-testimonial')).toBe(true);
        });

        it('should populate quote textarea from data', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Best purchase ever.',
                    authorName: 'George',
                    variant: 'card',
                },
            });
            const el = tool.render();
            const textarea = el.querySelector<HTMLTextAreaElement>('.cdx-testimonial__quote-input');
            expect(textarea?.value).toBe('Best purchase ever.');
        });

        it('should render variant select with correct selected option', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Love it.',
                    authorName: 'Hannah',
                    variant: 'minimal',
                },
            });
            const el = tool.render();
            const select = el.querySelector<HTMLSelectElement>('.cdx-testimonial__variant-select');
            expect(select?.value).toBe('minimal');
        });

        it('should render 5 star buttons', () => {
            const tool = new TestimonialTool({ api: mockAPI as any, config: {} });
            const el = tool.render();
            const stars = el.querySelectorAll('.cdx-testimonial__star');
            expect(stars).toHaveLength(5);
        });

        it('should mark filled stars for initial rating', () => {
            const tool = new TestimonialTool({
                api: mockAPI as any,
                config: {},
                data: {
                    quote: 'Excellent.',
                    authorName: 'Ivan',
                    rating: 4,
                    variant: 'card',
                },
            });
            const el = tool.render();
            const filledStars = el.querySelectorAll('.cdx-testimonial__star--filled');
            expect(filledStars).toHaveLength(4);
        });
    });
});
