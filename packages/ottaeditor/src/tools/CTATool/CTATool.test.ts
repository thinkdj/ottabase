import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { API } from '@editorjs/editorjs';
import CTATool, { type CTAData } from './CTATool';

const api = {} as API;
const tools: CTATool[] = [];

function mount(data: Partial<CTAData> = {}, config = {}) {
    const tool = new CTATool({ api, data, config, block: {} as never, readOnly: false });
    const element = tool.render();
    document.body.appendChild(element);
    tools.push(tool);
    return { tool, element };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('CTATool', () => {
    it('takes its toolbox entry from the block registry', () => {
        expect(CTATool.toolbox.title).toBe('Button');
        expect(CTATool.toolbox.icon).toContain('<svg');
        expect(CTATool.enableLineBreaks).toBe(true);
    });

    it('starts from defaults and config', () => {
        expect(mount().tool.save()).toEqual({
            text: 'Get Started',
            url: '',
            style: 'primary',
            alignment: 'center',
            openInNewTab: false,
            icon: '',
        });
        expect(mount({}, { defaultStyle: 'outline', defaultAlignment: 'left' }).tool.save()).toMatchObject({
            style: 'outline',
            alignment: 'left',
        });
    });

    it('keeps provided data', () => {
        const { tool } = mount({
            text: 'Sign Up',
            url: 'https://example.com',
            style: 'secondary',
            alignment: 'left',
            openInNewTab: true,
        });
        expect(tool.save()).toMatchObject({
            text: 'Sign Up',
            url: 'https://example.com',
            style: 'secondary',
            alignment: 'left',
            openInNewTab: true,
        });
    });

    it('opens in edit mode when empty and in preview when it has a link', () => {
        expect(mount().element.dataset.mode).toBe('edit');
        expect(mount({ url: 'https://x.io' }).element.dataset.mode).toBe('preview');
    });

    it('edits every field through the kit controls', () => {
        const { tool, element } = mount();
        fireEvent.input(screen.getByLabelText('Label'), { target: { value: 'Click Here' } });
        fireEvent.input(screen.getByLabelText('Link'), { target: { value: 'https://test.com' } });
        fireEvent.click(
            within(screen.getByRole('radiogroup', { name: 'Button style' })).getByRole('radio', { name: 'Outline' }),
        );
        fireEvent.click(
            within(screen.getByRole('radiogroup', { name: 'Alignment' })).getByRole('radio', { name: 'Right' }),
        );
        fireEvent.click(screen.getByRole('switch'));
        expect(tool.save()).toEqual({
            text: 'Click Here',
            url: 'https://test.com',
            style: 'outline',
            alignment: 'right',
            openInNewTab: true,
            icon: '',
        });
        expect(element.querySelector('.oe-block__summary')?.textContent).toBe('Outline · right');
        expect(
            within(screen.getByRole('radiogroup', { name: 'Alignment' }))
                .getByRole('radio', { name: 'Right' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('validates that both label and link are present', () => {
        const { tool } = mount({ text: 'Go', url: 'https://x.io' });
        expect(tool.validate(tool.save())).toBe(true);
        expect(tool.validate({ ...tool.save(), text: '   ' })).toBe(false);
        expect(tool.validate({ ...tool.save(), url: '' })).toBe(false);
    });
});
