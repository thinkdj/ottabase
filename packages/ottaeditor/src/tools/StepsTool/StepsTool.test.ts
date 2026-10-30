import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { API } from '@editorjs/editorjs';
import { DEFAULT_PLUGIN_NAMES, defaultPluginsMap } from '../../defaultPlugins';
import StepsTool, { type StepsData } from './StepsTool';

const tools: StepsTool[] = [];

function mount(data?: Partial<StepsData>) {
    const tool = new StepsTool({ api: {} as API, data, config: {}, block: {} as never, readOnly: false });
    const element = tool.render();
    document.body.appendChild(element);
    tools.push(tool);
    return { tool, element };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('StepsTool', () => {
    it('is registered under its plugin name with the registry title', () => {
        expect(DEFAULT_PLUGIN_NAMES.STEPS).toBe('steps');
        expect(defaultPluginsMap.get(DEFAULT_PLUGIN_NAMES.STEPS)?.tool).toBe(StepsTool);
        expect(StepsTool.toolbox.title).toBe('Steps');
    });

    it('renders one empty row in edit mode and saves only filled rows', () => {
        const { tool, element } = mount();
        expect(element.dataset.mode).toBe('edit');
        expect(screen.getByRole('button', { name: 'Add step' })).toBeTruthy();
        fireEvent.input(screen.getByLabelText('Step 1 title'), { target: { value: 'Choose your blocks' } });
        fireEvent.input(screen.getByLabelText('Step 1 content'), { target: { value: 'Start with the structure.' } });
        expect(tool.save()).toEqual({ items: [{ title: 'Choose your blocks', content: 'Start with the structure.' }] });
        expect(element.querySelector('.oe-block__summary')?.textContent).toBe('1 step');
    });

    it('adds, reorders and removes steps through the list controls', async () => {
        const { tool } = mount({
            items: [
                { title: 'First', content: 'Draft.' },
                { title: 'Second', content: 'Review.' },
            ],
        });
        fireEvent.click(screen.getByRole('button', { name: 'Move step 1 down' }));
        expect(tool.save().items.map((i) => i.title)).toEqual(['Second', 'First']);
        fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
        fireEvent.input(screen.getByLabelText('Step 3 title'), { target: { value: 'Publish' } });
        expect(tool.save().items.map((i) => i.title)).toEqual(['Second', 'First', 'Publish']);
        fireEvent.click(screen.getByRole('button', { name: 'Remove step 3' }));
        // the row had content, so the list asks first
        fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
        await waitFor(() => expect(tool.save().items.map((i) => i.title)).toEqual(['Second', 'First']));
    });

    it('never removes the last row and rejects empty payloads', () => {
        const { tool } = mount();
        expect((screen.getByRole('button', { name: 'Remove step 1' }) as HTMLButtonElement).disabled).toBe(true);
        expect(tool.validate({ items: [] })).toBe(false);
        expect(tool.validate({ items: [{ title: 'Ready', content: '' }] })).toBe(true);
    });
});
