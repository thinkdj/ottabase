import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { API } from '@editorjs/editorjs';
import ReviewTool, { type ReviewData, type ReviewToolConfig } from './ReviewTool';

const tools: ReviewTool[] = [];

function mount(data: Partial<ReviewData> = {}, config: ReviewToolConfig = {}) {
    const tool = new ReviewTool({ api: {} as API, data, config, block: {} as never, readOnly: false });
    const element = tool.render();
    document.body.appendChild(element);
    tools.push(tool);
    return { tool, element };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('ReviewTool', () => {
    it('takes its toolbox entry from the registry and allows line breaks', () => {
        expect(ReviewTool.toolbox.title).toBe('Review');
        expect(ReviewTool.toolbox.icon).toContain('<svg');
        expect(ReviewTool.enableLineBreaks).toBe(true);
    });

    it('starts from defaults and config', () => {
        const { tool, element } = mount();
        expect(element.dataset.mode).toBe('edit');
        expect(tool.save()).toEqual({
            title: '',
            content: '',
            linkUrl: '',
            linkLabel: '',
            pros: [],
            cons: [],
            rating: 0,
            maxStars: 5,
            allowHalfStars: true,
            summary: '',
            compact: false,
        });
        expect(mount({}, { maxStars: 10, allowHalfStars: false }).tool.save()).toMatchObject({
            maxStars: 10,
            allowHalfStars: false,
        });
    });

    it('keeps provided data and filters empty pros and cons', () => {
        const { tool, element } = mount({
            title: 'Great Product',
            content: 'This is a detailed review.',
            image: 'https://example.com/img.jpg',
            linkUrl: 'https://example.com',
            linkLabel: 'Buy Now',
            pros: ['Fast', '', 'Reliable', '  '],
            cons: ['Expensive', ''],
            rating: 4.5,
            summary: 'Highly recommended.',
        });
        expect(element.dataset.mode).toBe('preview');
        expect(tool.save()).toMatchObject({
            title: 'Great Product',
            image: 'https://example.com/img.jpg',
            pros: ['Fast', 'Reliable'],
            cons: ['Expensive'],
            rating: 4.5,
            maxStars: 5,
            summary: 'Highly recommended.',
        });
        expect(element.querySelector('.oe-block__summary')?.textContent).toBe('4.5/5');
    });

    it('edits fields, rating and pros/cons through the kit', () => {
        const { tool } = mount();
        fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'New Title' } });
        fireEvent.input(screen.getByLabelText('Image'), { target: { value: 'https://img.test/p.png' } });
        fireEvent.click(screen.getByRole('button', { name: 'Rate 3 out of 5' }));
        expect(tool.save()).toMatchObject({ title: 'New Title', image: 'https://img.test/p.png', rating: 3 });
        // clicking the same star clears; the rating never goes negative
        fireEvent.click(screen.getByRole('button', { name: 'Rate 3 out of 5' }));
        expect(tool.save().rating).toBe(0);
        fireEvent.input(screen.getByLabelText('Rating value'), { target: { value: '4.5' } });
        expect(tool.save().rating).toBe(4.5);
        fireEvent.input(screen.getByLabelText('Pro 1'), { target: { value: 'Good' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add pro' }));
        fireEvent.input(screen.getByLabelText('Pro 2'), { target: { value: 'Great' } });
        fireEvent.input(screen.getByLabelText('Con 1'), { target: { value: 'Bad' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add con' }));
        expect(tool.save()).toMatchObject({ pros: ['Good', 'Great'], cons: ['Bad'] });
        fireEvent.click(screen.getByRole('switch'));
        expect(tool.save().compact).toBe(true);
    });

    it('switches scale and half-star support, clamping and rounding the rating', () => {
        const { tool } = mount({ rating: 8, maxStars: 10 });
        expect(screen.getAllByRole('button', { name: /Rate \d+ out of 10/ })).toHaveLength(10);
        fireEvent.change(screen.getByLabelText('Max stars'), { target: { value: '5' } });
        expect(tool.save()).toMatchObject({ maxStars: 5, rating: 5 });
        expect(screen.getAllByRole('button', { name: /Rate \d+ out of 5/ })).toHaveLength(5);
        fireEvent.input(screen.getByLabelText('Rating value'), { target: { value: '3.5' } });
        fireEvent.click(screen.getByLabelText('Half stars'));
        expect(tool.save()).toMatchObject({ allowHalfStars: false, rating: 4 });
    });

    it('validates on a non-blank title', () => {
        const { tool } = mount();
        expect(tool.validate({ title: 'Ok' })).toBe(true);
        expect(tool.validate({ title: '' })).toBe(false);
        expect(tool.validate({ title: '   ' })).toBe(false);
    });
});
