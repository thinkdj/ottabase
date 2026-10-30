import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { API } from '@editorjs/editorjs';
import ReferencesTool, { type ReferencesData, type ReferencesToolConfig } from '../ReferencesTool';

const tools: ReferencesTool[] = [];

function mount(data?: Partial<ReferencesData>, config: ReferencesToolConfig = {}) {
    const tool = new ReferencesTool({ api: {} as API, data, config, block: {} as never, readOnly: false });
    const element = tool.render();
    document.body.appendChild(element);
    tools.push(tool);
    return { tool, element };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('ReferencesTool', () => {
    it('takes its toolbox entry from the registry and allows line breaks', () => {
        expect(ReferencesTool.toolbox.title).toBe('References');
        expect(ReferencesTool.toolbox.icon).toContain('<svg');
        expect(ReferencesTool.enableLineBreaks).toBe(true);
    });

    it('starts with one empty row that does not save, and honours the configured style', () => {
        const { tool, element } = mount();
        expect(element.dataset.mode).toBe('edit');
        expect(tool.save()).toEqual({ style: 'numbered', items: [] });
        expect(mount({}, { defaultStyle: 'footnote' }).tool.save().style).toBe('footnote');
    });

    it('keeps ids, trims, omits empty optionals and drops rows without a URL', () => {
        const { tool, element } = mount({
            style: 'footnote',
            items: [
                {
                    id: 'a',
                    url: '  https://example.com ',
                    title: ' Example ',
                    authors: 'Author',
                    year: '2024',
                    accessedDate: '',
                    note: '',
                },
                { id: 'b', url: '', title: 'No url' },
                { id: 'c', url: 'https://editorjs.io', title: 'EditorJS' },
            ],
        });
        expect(element.dataset.mode).toBe('preview');
        expect(tool.save()).toEqual({
            style: 'footnote',
            items: [
                {
                    id: 'a',
                    url: 'https://example.com',
                    title: 'Example',
                    authors: 'Author',
                    year: '2024',
                    accessedDate: undefined,
                    note: undefined,
                },
                {
                    id: 'c',
                    url: 'https://editorjs.io',
                    title: 'EditorJS',
                    authors: undefined,
                    year: undefined,
                    accessedDate: undefined,
                    note: undefined,
                },
            ],
        });
        expect(element.querySelector('.oe-block__summary')?.textContent).toBe('2 sources · footnotes');
    });

    it('edits through the kit: style, fields, add and reorder', () => {
        const { tool } = mount();
        fireEvent.click(
            within(screen.getByRole('radiogroup', { name: 'References style' })).getByRole('radio', {
                name: 'Footnotes',
            }),
        );
        fireEvent.input(screen.getByLabelText('URL 1'), { target: { value: 'https://one.test' } });
        fireEvent.input(screen.getByLabelText('Title 1'), { target: { value: 'One' } });
        fireEvent.input(screen.getByLabelText('Year 1'), { target: { value: '2020' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add reference' }));
        fireEvent.input(screen.getByLabelText('URL 2'), { target: { value: 'https://two.test' } });
        fireEvent.click(screen.getByRole('button', { name: 'Move reference 2 up' }));
        const saved = tool.save();
        expect(saved.style).toBe('footnote');
        expect(saved.items.map((i) => i.url)).toEqual(['https://two.test', 'https://one.test']);
        expect(saved.items[1]).toMatchObject({ title: 'One', year: '2020' });
        expect(saved.items[0]!.id).toBeTruthy();
    });

    it('validates on at least one URL', () => {
        const { tool } = mount();
        expect(tool.validate({ style: 'numbered', items: [] })).toBe(false);
        expect(
            tool.validate({
                style: 'numbered',
                items: [
                    { id: '1', url: '' },
                    { id: '2', url: '  ' },
                ],
            }),
        ).toBe(false);
        expect(tool.validate({ style: 'numbered', items: [{ id: '1', url: 'https://x.test' }] })).toBe(true);
        expect(
            tool.validate({
                style: 'numbered',
                items: [
                    { id: '1', url: '' },
                    { id: '2', url: 'https://x.test' },
                ],
            }),
        ).toBe(true);
    });
});
