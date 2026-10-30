import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { API } from '@editorjs/editorjs';
import SpoilerTool, { type SpoilerData } from './SpoilerTool';

const tools: SpoilerTool[] = [];

function mount(data?: Partial<SpoilerData>) {
    const tool = new SpoilerTool({ api: {} as API, data, config: {}, block: {} as never, readOnly: false });
    const element = tool.render();
    document.body.appendChild(element);
    tools.push(tool);
    return { tool, element };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('SpoilerTool', () => {
    it('takes its toolbox entry from the registry', () => {
        expect(SpoilerTool.toolbox.title).toBe('Spoiler');
        expect(SpoilerTool.toolbox.icon).toContain('<svg');
    });

    it('opens in edit mode when empty, preview when filled', () => {
        expect(mount().element.dataset.mode).toBe('edit');
        expect(mount({ text: 'The butler did it.' }).element.dataset.mode).toBe('preview');
    });

    it('saves the typed text and summarises its length', () => {
        const { tool, element } = mount();
        fireEvent.input(screen.getByLabelText('Hidden text'), { target: { value: 'Rosebud' } });
        expect(tool.save()).toEqual({ text: 'Rosebud' });
        expect(element.querySelector('.oe-block__summary')?.textContent).toBe('7 characters');
    });

    it('rejects blank text', () => {
        const { tool } = mount();
        expect(tool.validate({ text: '   ' })).toBe(false);
        expect(tool.validate({ text: 'x' })).toBe(true);
    });
});
