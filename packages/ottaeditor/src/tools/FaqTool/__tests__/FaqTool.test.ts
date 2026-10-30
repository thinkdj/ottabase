import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { API } from '@editorjs/editorjs';
import FaqTool, { type FaqData, type FaqToolConfig } from '../FaqTool';

const tools: FaqTool[] = [];

function mount(data?: Partial<FaqData>, config: FaqToolConfig = {}) {
    const tool = new FaqTool({ api: {} as API, data, config, block: {} as never, readOnly: false });
    const element = tool.render();
    document.body.appendChild(element);
    tools.push(tool);
    return { tool, element };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('FaqTool', () => {
    it('takes its toolbox entry from the registry and allows line breaks', () => {
        expect(FaqTool.toolbox.title).toBe('FAQ');
        expect(FaqTool.toolbox.icon).toContain('<svg');
        expect(FaqTool.enableLineBreaks).toBe(true);
    });

    it('starts empty in edit mode; saves nothing until a question exists', () => {
        const { tool, element } = mount();
        expect(element.dataset.mode).toBe('edit');
        expect(tool.save()).toEqual({ style: 'accordion', items: [] });
        expect(mount({}, { defaultStyle: 'flat' }).tool.save().style).toBe('flat');
    });

    it('preserves, trims and filters items on save', () => {
        const { tool, element } = mount({
            style: 'flat',
            items: [
                { question: '  What is it? ', answer: ' A thing. ' },
                { question: '', answer: '' },
                { question: 'Price?', answer: '' },
            ],
        });
        expect(element.dataset.mode).toBe('preview');
        expect(tool.save()).toEqual({
            style: 'flat',
            items: [
                { question: 'What is it?', answer: 'A thing.' },
                { question: 'Price?', answer: '' },
            ],
        });
    });

    it('edits through the kit: style segment, question and answer fields, add and remove', async () => {
        const { tool, element } = mount();
        fireEvent.click(
            within(screen.getByRole('radiogroup', { name: 'FAQ style' })).getByRole('radio', { name: 'Flat' }),
        );
        fireEvent.input(screen.getByLabelText('Question 1'), { target: { value: 'Is it good?' } });
        fireEvent.input(screen.getByLabelText('Answer 1'), { target: { value: 'Yes.' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add question' }));
        fireEvent.input(screen.getByLabelText('Question 2'), { target: { value: 'Free?' } });
        expect(tool.save()).toEqual({
            style: 'flat',
            items: [
                { question: 'Is it good?', answer: 'Yes.' },
                { question: 'Free?', answer: '' },
            ],
        });
        expect(element.querySelector('.oe-block__summary')?.textContent).toBe('2 questions · flat');
        fireEvent.click(screen.getByRole('button', { name: 'Move question 2 up' }));
        expect(tool.save().items[0]!.question).toBe('Free?');
        fireEvent.click(screen.getByRole('button', { name: 'Remove question 1' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
        await waitFor(() => expect(tool.save().items).toHaveLength(1));
        expect((screen.getByRole('button', { name: 'Remove question 1' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('validates on a non-empty question', () => {
        const { tool } = mount();
        expect(tool.validate({ style: 'accordion', items: [{ question: 'Q', answer: '' }] })).toBe(true);
        expect(tool.validate({ style: 'accordion', items: [{ question: '  ', answer: 'A' }] })).toBe(false);
        expect(tool.validate({ style: 'accordion', items: [] })).toBe(false);
    });
});
