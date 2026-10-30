import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { API } from '@editorjs/editorjs';
import DisclosureTool, {
    AI_LEVEL_LABELS,
    AI_LEVEL_WORDING,
    SPONSORED_PRESET_TEXT,
    type AIDisclosureLevel,
    type DisclosureData,
    type DisclosureToolConfig,
} from './DisclosureTool';

const tools: DisclosureTool[] = [];

function mount(data: Partial<DisclosureData> = {}, config: DisclosureToolConfig = {}) {
    const tool = new DisclosureTool({ api: {} as API, data, config, block: {} as never, readOnly: false });
    const element = tool.render();
    document.body.appendChild(element);
    tools.push(tool);
    return { tool, element };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('DisclosureTool', () => {
    it('takes its toolbox entry from the registry and allows line breaks', () => {
        expect(DisclosureTool.toolbox.title).toBe('Disclosure');
        expect(DisclosureTool.toolbox.icon).toContain('<svg');
        expect(DisclosureTool.enableLineBreaks).toBe(true);
    });

    it('starts with safe defaults, honours provided data and config', () => {
        expect(mount().tool.save()).toMatchObject({
            aiEnabled: false,
            aiLevel: 'none',
            sponsoredEnabled: false,
            sponsoredType: 'preset',
        });
        expect(
            mount({
                aiEnabled: true,
                aiLevel: 'mid',
                sponsoredEnabled: true,
                sponsoredType: 'custom',
                sponsoredText: 'Paid partnership.',
            }).tool.save(),
        ).toMatchObject({
            aiEnabled: true,
            aiLevel: 'mid',
            sponsoredEnabled: true,
            sponsoredType: 'custom',
            sponsoredText: 'Paid partnership.',
        });
        expect(mount({}, { defaultAILevel: 'slight' }).tool.save()).toMatchObject({
            aiEnabled: true,
            aiLevel: 'slight',
        });
    });

    it('shows each section only while its switch is on, and the percent field only for a custom level', () => {
        const { tool } = mount();
        const [ai, sponsored] = screen.getAllByRole('switch');
        expect(screen.getByLabelText('AI usage level').closest('.oe-stack')?.hasAttribute('hidden')).toBe(true);
        fireEvent.click(ai!);
        // turning AI on picks the first level so the block is valid straight away
        expect(tool.save()).toMatchObject({ aiEnabled: true, aiLevel: 'slight' });
        expect(screen.getByLabelText('AI usage percent').closest('.oe-field')?.hasAttribute('hidden')).toBe(true);
        fireEvent.change(screen.getByLabelText('AI usage level'), { target: { value: 'custom' } });
        expect(screen.getByLabelText('AI usage percent').closest('.oe-field')?.hasAttribute('hidden')).toBe(false);
        fireEvent.input(screen.getByLabelText('AI usage percent'), { target: { value: '70' } });
        expect(tool.getAIDisclosureText()).toContain('70%');
        fireEvent.click(sponsored!);
        fireEvent.click(
            within(screen.getByRole('radiogroup', { name: 'Sponsored wording' })).getByRole('radio', {
                name: 'Custom',
            }),
        );
        fireEvent.input(screen.getByLabelText('Custom sponsored text'), { target: { value: 'Paid post.' } });
        expect(tool.save()).toMatchObject({
            sponsoredEnabled: true,
            sponsoredType: 'custom',
            sponsoredText: 'Paid post.',
        });
    });

    it('produces the standard wording', () => {
        expect(mount({ aiEnabled: false, aiLevel: 'high' }).tool.getAIDisclosureText()).toBe('');
        expect(mount({ aiEnabled: true, aiLevel: 'none' }).tool.getAIDisclosureText()).toBe('');
        for (const level of ['slight', 'mid', 'high'] as const) {
            expect(mount({ aiEnabled: true, aiLevel: level }).tool.getAIDisclosureText()).toBe(AI_LEVEL_WORDING[level]);
        }
        expect(mount({ aiEnabled: true, aiLevel: 'custom', aiPercent: 75 }).tool.getAIDisclosureText()).toContain(
            '75%',
        );
        expect(mount().tool.getSponsoredText()).toBe('');
        expect(mount({ sponsoredEnabled: true, sponsoredType: 'preset' }).tool.getSponsoredText()).toBe(
            SPONSORED_PRESET_TEXT,
        );
        expect(
            mount({
                sponsoredEnabled: true,
                sponsoredType: 'custom',
                sponsoredText: '  Paid post. ',
            }).tool.getSponsoredText(),
        ).toBe('Paid post.');
        expect(
            mount({ sponsoredEnabled: true, sponsoredType: 'custom', sponsoredText: '   ' }).tool.getSponsoredText(),
        ).toBe('');
    });

    it('validates coherent disclosures only', () => {
        const valid = (d: Partial<DisclosureData>) => {
            const { tool } = mount(d);
            return tool.validate(tool.save());
        };
        expect(valid({})).toBe(false);
        expect(valid({ aiEnabled: true, aiLevel: 'none' })).toBe(false);
        expect(valid({ aiEnabled: true, aiLevel: 'mid' })).toBe(true);
        expect(valid({ sponsoredEnabled: true, sponsoredType: 'preset' })).toBe(true);
        expect(valid({ sponsoredEnabled: true, sponsoredType: 'custom', sponsoredText: '' })).toBe(false);
        expect(valid({ sponsoredEnabled: true, sponsoredType: 'custom', sponsoredText: 'Sponsored by X' })).toBe(true);
        expect(valid({ aiEnabled: true, aiLevel: 'high', sponsoredEnabled: true, sponsoredType: 'preset' })).toBe(true);
    });

    it('exports its wording constants', () => {
        (['none', 'slight', 'mid', 'high', 'custom'] as AIDisclosureLevel[]).forEach((l) =>
            expect(AI_LEVEL_LABELS[l]).toBeTruthy(),
        );
        expect(SPONSORED_PRESET_TEXT.length).toBeGreaterThan(10);
    });
});
