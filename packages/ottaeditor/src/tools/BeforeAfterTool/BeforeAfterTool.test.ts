import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { API } from '@editorjs/editorjs';
import { DEFAULT_PLUGIN_NAMES, defaultPluginsMap } from '../../defaultPlugins';
import BeforeAfterTool, { type BeforeAfterData, type BeforeAfterToolConfig } from './BeforeAfterTool';

const tools: BeforeAfterTool[] = [];
const URLS = { beforeUrl: 'https://cdn.example.com/before.jpg', afterUrl: 'https://cdn.example.com/after.jpg' };

function mount(data?: Partial<BeforeAfterData>, config?: BeforeAfterToolConfig) {
    const tool = new BeforeAfterTool({ api: {} as API, data, config });
    const element = tool.render();
    document.body.appendChild(element);
    tools.push(tool);
    return { tool, element };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('BeforeAfterTool', () => {
    it('is registered and saves its defaults', () => {
        expect(defaultPluginsMap.get(DEFAULT_PLUGIN_NAMES.BEFORE_AFTER)?.tool).toBe(BeforeAfterTool);
        expect(BeforeAfterTool.toolbox.title).toBe('Before / after');
        expect(mount().tool.save()).toEqual({
            beforeUrl: '',
            afterUrl: '',
            beforeLabel: 'Before',
            afterLabel: 'After',
            orientation: 'horizontal',
            sliderPosition: 50,
            caption: '',
            height: '',
            imageFit: 'contain',
            beforePosition: 'center',
            afterPosition: 'center',
        });
        expect(
            mount(
                {},
                {
                    defaultOrientation: 'vertical',
                    defaultPosition: 30,
                    defaultImageFit: 'cover',
                    defaultHeight: '400px',
                },
            ).tool.save(),
        ).toMatchObject({ orientation: 'vertical', sliderPosition: 30, imageFit: 'cover', height: '400px' });
    });

    it('opens in edit mode without both images, in preview with them', () => {
        expect(mount({ beforeUrl: URLS.beforeUrl }).element.dataset.mode).toBe('edit');
        expect(mount(URLS).element.dataset.mode).toBe('preview');
    });

    it('edits reach save(): images, labels, orientation, start position, caption, sizing', () => {
        const { tool, element } = mount();
        fireEvent.input(screen.getByLabelText('Before image'), { target: { value: URLS.beforeUrl } });
        fireEvent.input(screen.getByLabelText('After image'), { target: { value: URLS.afterUrl } });
        fireEvent.input(screen.getByLabelText('Before label'), { target: { value: '' } });
        fireEvent.input(screen.getByLabelText('After label'), { target: { value: 'Now' } });
        fireEvent.click(screen.getByRole('radio', { name: 'Vertical' }));
        fireEvent.input(screen.getByLabelText('Start position'), { target: { value: '70' } });
        fireEvent.input(screen.getByLabelText('Caption'), { target: { value: 'Kitchen' } });
        fireEvent.click(screen.getByRole('radio', { name: 'Cover' }));
        fireEvent.click(
            within(screen.getByRole('radiogroup', { name: 'Before focus' })).getByRole('radio', { name: 'top left' }),
        );
        const height = screen.getByLabelText('Height') as HTMLInputElement;
        fireEvent.input(height, { target: { value: '420' } });
        fireEvent.blur(height);
        expect(tool.save()).toMatchObject({
            ...URLS,
            beforeLabel: '',
            afterLabel: 'Now',
            orientation: 'vertical',
            sliderPosition: 70,
            caption: 'Kitchen',
            imageFit: 'cover',
            beforePosition: 'top-left',
            height: '420px',
        });
        expect(element.querySelector('.oe-block__summary')?.textContent).toBe('vertical · 70%');
        expect(element.querySelector('.oe-compare__stage--vertical.oe-compare__stage--cover')).toBeTruthy();
        expect(element.querySelector('.oe-compare__label--before')).toBeNull();
    });

    it('rejects a nonsense height and caps oversized pixels', () => {
        const { tool } = mount(URLS);
        fireEvent.click(screen.getByRole('radio', { name: 'Edit' }));
        const height = screen.getByLabelText('Height') as HTMLInputElement;
        fireEvent.input(height, { target: { value: 'tall' } });
        fireEvent.blur(height);
        expect(tool.save().height).toBe('');
        fireEvent.input(height, { target: { value: '9000px' } });
        fireEvent.blur(height);
        expect(tool.save().height).toBe('');
        fireEvent.input(height, { target: { value: '50vh' } });
        fireEvent.blur(height);
        expect(tool.save().height).toBe('50vh');
    });

    it('moves the divider from the stage and mirrors it to the range', () => {
        const { tool, element } = mount({ ...URLS, sliderPosition: 50 });
        fireEvent.click(screen.getByRole('radio', { name: 'Edit' }));
        const stage = element.querySelector('.oe-compare__stage') as HTMLElement;
        stage.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            width: 200,
            height: 100,
            right: 200,
            bottom: 100,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });
        fireEvent.pointerDown(stage, { button: 0, clientX: 50, clientY: 20, pointerId: 1 });
        fireEvent.pointerMove(stage, { clientX: 160, clientY: 20, pointerId: 1 });
        fireEvent.pointerUp(stage, { pointerId: 1 });
        expect(tool.save().sliderPosition).toBe(80);
        expect((screen.getByLabelText('Start position') as HTMLInputElement).value).toBe('80');
        // triple-click cycles: 80 → 0
        fireEvent.click(stage, { detail: 3 });
        expect(tool.save().sliderPosition).toBe(0);
        fireEvent.keyDown(stage, { key: 'ArrowRight', shiftKey: true });
        expect(tool.save().sliderPosition).toBe(10);
    });

    it('validates that at least one image is set', () => {
        const { tool } = mount();
        expect(tool.validate(tool.save())).toBe(false);
        expect(tool.validate({ ...tool.save(), afterUrl: URLS.afterUrl })).toBe(true);
    });
});
