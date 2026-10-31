import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { API } from '@editorjs/editorjs';
import TestimonialTool, { type TestimonialData, type TestimonialToolConfig } from '../TestimonialTool';

const tools: TestimonialTool[] = [];

function mount(data?: Partial<TestimonialData>, config: TestimonialToolConfig = {}) {
    const tool = new TestimonialTool({ api: {} as API, data, config, block: {} as never, readOnly: false });
    const element = tool.render();
    document.body.appendChild(element);
    tools.push(tool);
    return { tool, element };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

const full: TestimonialData = {
    quote: 'Changed how we work.',
    authorName: 'Alice',
    authorRole: 'CTO',
    authorCompany: 'Globex',
    authorAvatar: 'https://img.test/a.png',
    // A stored file is kept as is
    companyLogo: { key: 'app/media/0123456789abcdef0123456789abcdef.png', width: 240, height: 80 },
    rating: 5,
    variant: 'featured',
    sourceUrl: 'https://x.test/review',
    verified: true,
};

describe('TestimonialTool', () => {
    it('takes its toolbox entry from the registry and allows line breaks', () => {
        expect(TestimonialTool.toolbox.title).toBe('Testimonial');
        expect(TestimonialTool.toolbox.icon).toContain('<svg');
        expect(TestimonialTool.enableLineBreaks).toBe(true);
    });

    it('defaults to the card variant, or the configured one', () => {
        expect(mount().tool.save()).toMatchObject({ variant: 'card', quote: '', authorName: '' });
        expect(mount({}, { defaultVariant: 'featured' }).tool.save().variant).toBe('featured');
        expect(mount().element.dataset.mode).toBe('edit');
    });

    it('preserves every field, trims strings, and drops empties and a zero rating', () => {
        const { tool, element } = mount(full);
        expect(element.dataset.mode).toBe('preview');
        expect(tool.save()).toEqual(full);
        const sparse = mount({
            quote: '  Great product!  ',
            authorName: ' Bob ',
            authorRole: '  ',
            authorCompany: '',
            rating: 0,
            variant: 'minimal',
        }).tool.save();
        expect(sparse).toEqual({
            quote: 'Great product!',
            authorName: 'Bob',
            variant: 'minimal',
            authorRole: undefined,
            authorCompany: undefined,
            authorAvatar: undefined,
            companyLogo: undefined,
            rating: undefined,
            sourceUrl: undefined,
            verified: undefined,
        });
    });

    it('edits through the kit controls', () => {
        const { tool, element } = mount();
        fireEvent.input(screen.getByLabelText('Quote'), { target: { value: 'Loved it!' } });
        fireEvent.input(screen.getByLabelText('Author'), { target: { value: 'Eve' } });
        fireEvent.input(screen.getByLabelText('Role'), { target: { value: 'Founder' } });
        fireEvent.change(screen.getByLabelText('Variant'), { target: { value: 'quote-bubble' } });
        fireEvent.click(screen.getByRole('switch'));
        fireEvent.click(screen.getByRole('button', { name: 'Rate 4 out of 5' }));
        fireEvent.input(screen.getByLabelText('Avatar'), { target: { value: 'https://img.test/e.png' } });
        expect(tool.save()).toMatchObject({
            quote: 'Loved it!',
            authorName: 'Eve',
            authorRole: 'Founder',
            variant: 'quote-bubble',
            verified: true,
            rating: 4,
            authorAvatar: 'https://img.test/e.png',
        });
        expect(element.querySelector('.oe-block__summary')?.textContent).toBe('Quote bubble · 4/5');
        // clicking the same star again clears the rating
        fireEvent.click(screen.getByRole('button', { name: 'Rate 4 out of 5' }));
        expect(tool.save().rating).toBeUndefined();
    });

    it('validates quote and author together', () => {
        const { tool } = mount();
        expect(tool.validate({ quote: 'Loved it!', authorName: 'Eve', variant: 'card' })).toBe(true);
        expect(tool.validate({ quote: '', authorName: 'Frank', variant: 'card' })).toBe(false);
        expect(tool.validate({ quote: 'Great!', authorName: '', variant: 'card' })).toBe(false);
        expect(tool.validate({ quote: '   ', authorName: '   ', variant: 'card' })).toBe(false);
    });
});
