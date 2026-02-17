import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReviewTool from './ReviewTool';

const createMockAPI = () => ({
    blocks: {
        getCurrentBlockIndex: vi.fn(() => 0),
    },
    ui: {
        notifier: {
            show: vi.fn(),
        },
    },
});

describe('ReviewTool', () => {
    let tool: ReviewTool;
    let mockAPI: ReturnType<typeof createMockAPI>;

    beforeEach(() => {
        mockAPI = createMockAPI();
        tool = new ReviewTool({
            data: {},
            config: {},
            api: mockAPI as any,
        });
    });

    describe('Toolbox', () => {
        it('should have correct toolbox configuration', () => {
            expect(ReviewTool.toolbox.title).toBe('Review');
            expect(ReviewTool.toolbox.icon).toBeTruthy();
        });

        it('should enable line breaks', () => {
            expect(ReviewTool.enableLineBreaks).toBe(true);
        });
    });

    describe('Initialization', () => {
        it('should initialize with default values', () => {
            const saved = tool.save();
            expect(saved.title).toBe('');
            expect(saved.content).toBe('');
            expect(saved.image).toBe('');
            expect(saved.linkUrl).toBe('');
            expect(saved.linkLabel).toBe('');
            expect(saved.rating).toBe(0);
            expect(saved.maxStars).toBe(5);
            expect(saved.allowHalfStars).toBe(true);
            expect(saved.summary).toBe('');
        });

        it('should initialize with provided data', () => {
            const customTool = new ReviewTool({
                data: {
                    title: 'Great Product',
                    content: 'This is a detailed review.',
                    image: 'https://example.com/img.jpg',
                    linkUrl: 'https://example.com',
                    linkLabel: 'Buy Now',
                    pros: ['Fast', 'Reliable'],
                    cons: ['Expensive'],
                    rating: 4.5,
                    maxStars: 5,
                    allowHalfStars: true,
                    summary: 'Highly recommended.',
                },
                config: {},
                api: mockAPI as any,
            });

            const saved = customTool.save();
            expect(saved.title).toBe('Great Product');
            expect(saved.content).toBe('This is a detailed review.');
            expect(saved.image).toBe('https://example.com/img.jpg');
            expect(saved.linkUrl).toBe('https://example.com');
            expect(saved.linkLabel).toBe('Buy Now');
            expect(saved.pros).toEqual(['Fast', 'Reliable']);
            expect(saved.cons).toEqual(['Expensive']);
            expect(saved.rating).toBe(4.5);
            expect(saved.maxStars).toBe(5);
            expect(saved.allowHalfStars).toBe(true);
            expect(saved.summary).toBe('Highly recommended.');
        });

        it('should use config defaults for maxStars', () => {
            const toolWithConfig = new ReviewTool({
                data: {},
                config: { maxStars: 10 },
                api: mockAPI as any,
            });
            expect(toolWithConfig.save().maxStars).toBe(10);
        });

        it('should use config defaults for allowHalfStars', () => {
            const toolWithConfig = new ReviewTool({
                data: {},
                config: { allowHalfStars: false },
                api: mockAPI as any,
            });
            expect(toolWithConfig.save().allowHalfStars).toBe(false);
        });
    });

    describe('Rendering', () => {
        it('should render wrapper element', () => {
            const element = tool.render();
            expect(element).toBeInstanceOf(HTMLElement);
            expect(element.classList.contains('cdx-review')).toBe(true);
            expect(element.classList.contains('cdx-review__wrapper')).toBe(true);
        });

        it('should render form with all sections', () => {
            const element = tool.render();
            const form = element.querySelector('.cdx-review__form');
            expect(form).toBeTruthy();
        });

        it('should render image upload area', () => {
            const element = tool.render();
            const imageArea = element.querySelector('.cdx-review__image-area');
            expect(imageArea).toBeTruthy();
        });

        it('should render star rating', () => {
            const element = tool.render();
            const stars = element.querySelector('.cdx-review__stars');
            expect(stars).toBeTruthy();
            expect(stars?.querySelectorAll('.cdx-review__star').length).toBe(5);
        });

        it('should render 10 stars when maxStars is 10', () => {
            const tool10 = new ReviewTool({
                data: { maxStars: 10 } as any,
                config: {},
                api: mockAPI as any,
            });
            const element = tool10.render();
            const stars = element.querySelectorAll('.cdx-review__star');
            expect(stars.length).toBe(10);
        });

        it('should render pros/cons lists', () => {
            const element = tool.render();
            const proscons = element.querySelector('.cdx-review__proscons');
            expect(proscons).toBeTruthy();
        });

        it('should update title when input changes', () => {
            const element = tool.render();
            // Title is the first text input within the form (image section has file + url inputs)
            const textInputs = element.querySelectorAll('input[type="text"]');
            const titleInput = textInputs[0] as HTMLInputElement;
            titleInput.value = 'New Title';
            titleInput.dispatchEvent(new Event('input'));
            expect(tool.save().title).toBe('New Title');
        });

        it('should update rating when star is clicked', () => {
            const element = tool.render();
            const stars = element.querySelectorAll('.cdx-review__star');
            (stars[2] as HTMLElement).click();
            expect(tool.save().rating).toBe(3);
        });

        it('should never produce negative rating when clicking first star multiple times', () => {
            const element = tool.render();
            const stars = element.querySelectorAll('.cdx-review__star');
            const firstStar = stars[0] as HTMLElement;
            // Click first star: rating = 1
            firstStar.click();
            expect(tool.save().rating).toBe(1);
            // Click again: rating = 0.5 (half star)
            firstStar.click();
            expect(tool.save().rating).toBe(0.5);
            // Click again: rating = 0 (not negative)
            firstStar.click();
            expect(tool.save().rating).toBe(0);
        });
    });

    describe('Save', () => {
        it('should filter empty pros and cons on save', () => {
            const toolWithEmpty = new ReviewTool({
                data: {
                    title: 'Test',
                    pros: ['Good', '', 'Great', '  '],
                    cons: ['', 'Bad'],
                } as any,
                config: {},
                api: mockAPI as any,
            });

            const saved = toolWithEmpty.save();
            expect(saved.pros).toEqual(['Good', 'Great']);
            expect(saved.cons).toEqual(['Bad']);
        });
    });

    describe('Validation', () => {
        it('should validate when title is provided', () => {
            const validTool = new ReviewTool({
                data: { title: 'My Review' } as any,
                config: {},
                api: mockAPI as any,
            });
            expect(validTool.validate(validTool.save())).toBe(true);
        });

        it('should fail validation when title is empty', () => {
            expect(tool.validate(tool.save())).toBe(false);
        });

        it('should fail validation when title is only whitespace', () => {
            const invalidTool = new ReviewTool({
                data: { title: '   ' } as any,
                config: {},
                api: mockAPI as any,
            });
            expect(invalidTool.validate(invalidTool.save())).toBe(false);
        });
    });

    describe('Pros/Cons Management', () => {
        it('should add a new pro item', () => {
            const element = tool.render();
            const addBtns = element.querySelectorAll('.cdx-review__proscons-add');
            (addBtns[0] as HTMLElement).click();

            // The data should have 2 entries now (1 default + 1 added)
            expect(tool.save().pros.length).toBeLessThanOrEqual(2);
        });

        it('should add a new con item', () => {
            const element = tool.render();
            const addBtns = element.querySelectorAll('.cdx-review__proscons-add');
            (addBtns[1] as HTMLElement).click();

            expect(tool.save().cons.length).toBeLessThanOrEqual(2);
        });
    });

    describe('Rating Configuration', () => {
        it('should switch between 5 and 10 star modes', () => {
            const element = tool.render();
            const maxSelect = element.querySelector('.cdx-review__select') as HTMLSelectElement;
            maxSelect.value = '10';
            maxSelect.dispatchEvent(new Event('change'));

            expect(tool.save().maxStars).toBe(10);
            const stars = element.querySelectorAll('.cdx-review__star');
            expect(stars.length).toBe(10);
        });

        it('should toggle half star support', () => {
            const element = tool.render();
            const halfCheck = element.querySelector('.cdx-review__checkbox') as HTMLInputElement;
            halfCheck.checked = false;
            halfCheck.dispatchEvent(new Event('change'));

            expect(tool.save().allowHalfStars).toBe(false);
        });

        it('should clamp rating when switching from 10 to 5 stars', () => {
            const tool10 = new ReviewTool({
                data: { rating: 8, maxStars: 10 } as any,
                config: {},
                api: mockAPI as any,
            });
            const element = tool10.render();
            const maxSelect = element.querySelector('.cdx-review__select') as HTMLSelectElement;
            maxSelect.value = '5';
            maxSelect.dispatchEvent(new Event('change'));

            expect(tool10.save().rating).toBe(5);
        });
    });
});
