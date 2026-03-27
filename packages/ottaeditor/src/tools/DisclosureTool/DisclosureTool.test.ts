import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisclosureTool, { AI_LEVEL_LABELS, AI_LEVEL_WORDING, SPONSORED_PRESET_TEXT } from './DisclosureTool';

// Mock CSS import
vi.mock('./DisclosureTool.css', () => ({}));

const createMockAPI = () => ({
    blocks: { getCurrentBlockIndex: vi.fn(() => 0) },
    ui: { notifier: { show: vi.fn() } },
});

describe('DisclosureTool', () => {
    let mockAPI: ReturnType<typeof createMockAPI>;

    beforeEach(() => {
        mockAPI = createMockAPI();
    });

    describe('Toolbox', () => {
        it('should have correct toolbox title', () => {
            expect(DisclosureTool.toolbox.title).toBe('Disclosure');
        });

        it('should have a toolbox icon', () => {
            expect(DisclosureTool.toolbox.icon).toBeTruthy();
            expect(DisclosureTool.toolbox.icon).toContain('svg');
        });

        it('should enable line breaks', () => {
            expect(DisclosureTool.enableLineBreaks).toBe(true);
        });
    });

    describe('Initialization – defaults', () => {
        it('should initialize with safe defaults', () => {
            const tool = new DisclosureTool({ data: {}, config: {}, api: mockAPI as any });
            const saved = tool.save();
            expect(saved.aiEnabled).toBe(false);
            expect(saved.aiLevel).toBe('none');
            expect(saved.sponsoredEnabled).toBe(false);
            expect(saved.sponsoredType).toBe('preset');
        });

        it('should initialise from provided data', () => {
            const tool = new DisclosureTool({
                data: {
                    aiEnabled: true,
                    aiLevel: 'mid',
                    sponsoredEnabled: true,
                    sponsoredType: 'custom',
                    sponsoredText: 'Paid partnership.',
                },
                config: {},
                api: mockAPI as any,
            });
            const saved = tool.save();
            expect(saved.aiEnabled).toBe(true);
            expect(saved.aiLevel).toBe('mid');
            expect(saved.sponsoredEnabled).toBe(true);
            expect(saved.sponsoredType).toBe('custom');
            expect(saved.sponsoredText).toBe('Paid partnership.');
        });

        it('should respect config defaultAILevel', () => {
            const tool = new DisclosureTool({
                data: {},
                config: { defaultAILevel: 'slight' },
                api: mockAPI as any,
            });
            const saved = tool.save();
            expect(saved.aiEnabled).toBe(true);
            expect(saved.aiLevel).toBe('slight');
        });
    });

    describe('Rendering', () => {
        it('should render a wrapper element', () => {
            const tool = new DisclosureTool({ data: {}, config: {}, api: mockAPI as any });
            const el = tool.render();
            expect(el).toBeInstanceOf(HTMLElement);
            expect(el.classList.contains('cdx-disclosure__wrapper')).toBe(true);
        });

        it('should render AI and Sponsored sections', () => {
            const tool = new DisclosureTool({ data: {}, config: {}, api: mockAPI as any });
            const el = tool.render();
            const sections = el.querySelectorAll('.cdx-disclosure__section');
            expect(sections.length).toBe(2);
        });

        it('should render AI level select', () => {
            const tool = new DisclosureTool({ data: {}, config: {}, api: mockAPI as any });
            const el = tool.render();
            const select = el.querySelector('[id^="disclosure-ai-level-"]') as HTMLSelectElement;
            expect(select).toBeTruthy();
            // Should have options for each level (excluding 'none' from select)
            expect(select.options.length).toBe(4);
        });

        it('should render sponsored type radio buttons', () => {
            const tool = new DisclosureTool({ data: {}, config: {}, api: mockAPI as any });
            const el = tool.render();
            const radios = el.querySelectorAll('input[name^="disclosure-sponsored-type-"]');
            expect(radios.length).toBe(2);
        });

        it('should hide AI body when AI is disabled', () => {
            const tool = new DisclosureTool({ data: { aiEnabled: false }, config: {}, api: mockAPI as any });
            const el = tool.render();
            const body = el.querySelector('.cdx-disclosure__section-body') as HTMLElement;
            expect(body.style.display).toBe('none');
        });

        it('should show AI body when AI is enabled', () => {
            const tool = new DisclosureTool({
                data: { aiEnabled: true, aiLevel: 'slight' },
                config: {},
                api: mockAPI as any,
            });
            const el = tool.render();
            const bodies = el.querySelectorAll('.cdx-disclosure__section-body') as NodeListOf<HTMLElement>;
            expect(bodies[0].style.display).toBe('flex');
        });

        it('should show percent input only when level is custom', () => {
            const tool = new DisclosureTool({
                data: { aiEnabled: true, aiLevel: 'custom', aiPercent: 70 },
                config: {},
                api: mockAPI as any,
            });
            const el = tool.render();
            const percentInput = el.querySelector('[id^="disclosure-ai-percent-"]') as HTMLInputElement;
            expect(percentInput).toBeTruthy();
            expect(percentInput.value).toBe('70');
        });

        it('should toggle AI body when toggle is clicked', () => {
            const tool = new DisclosureTool({ data: { aiEnabled: false }, config: {}, api: mockAPI as any });
            const el = tool.render();
            const checkbox = el.querySelector('[id^="ai-enabled-"]') as HTMLInputElement;

            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));

            const saved = tool.save();
            expect(saved.aiEnabled).toBe(true);
        });

        it('should toggle sponsored body when toggle is clicked', () => {
            const tool = new DisclosureTool({ data: { sponsoredEnabled: false }, config: {}, api: mockAPI as any });
            const el = tool.render();
            const checkbox = el.querySelector('[id^="sponsored-enabled-"]') as HTMLInputElement;

            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));

            const saved = tool.save();
            expect(saved.sponsoredEnabled).toBe(true);
        });
    });

    describe('AI Disclosure Text', () => {
        it('should return empty string when AI is disabled', () => {
            const tool = new DisclosureTool({
                data: { aiEnabled: false, aiLevel: 'slight' },
                config: {},
                api: mockAPI as any,
            });
            expect(tool.getAIDisclosureText()).toBe('');
        });

        it('should return empty string when level is none', () => {
            const tool = new DisclosureTool({
                data: { aiEnabled: true, aiLevel: 'none' },
                config: {},
                api: mockAPI as any,
            });
            expect(tool.getAIDisclosureText()).toBe('');
        });

        it('should return slight wording', () => {
            const tool = new DisclosureTool({
                data: { aiEnabled: true, aiLevel: 'slight' },
                config: {},
                api: mockAPI as any,
            });
            expect(tool.getAIDisclosureText()).toBe(AI_LEVEL_WORDING.slight);
        });

        it('should return mid wording', () => {
            const tool = new DisclosureTool({
                data: { aiEnabled: true, aiLevel: 'mid' },
                config: {},
                api: mockAPI as any,
            });
            expect(tool.getAIDisclosureText()).toBe(AI_LEVEL_WORDING.mid);
        });

        it('should return high wording', () => {
            const tool = new DisclosureTool({
                data: { aiEnabled: true, aiLevel: 'high' },
                config: {},
                api: mockAPI as any,
            });
            expect(tool.getAIDisclosureText()).toBe(AI_LEVEL_WORDING.high);
        });

        it('should return custom percent wording', () => {
            const tool = new DisclosureTool({
                data: { aiEnabled: true, aiLevel: 'custom', aiPercent: 75 },
                config: {},
                api: mockAPI as any,
            });
            const text = tool.getAIDisclosureText();
            expect(text).toContain('75%');
        });
    });

    describe('Sponsored Text', () => {
        it('should return empty when sponsored is disabled', () => {
            const tool = new DisclosureTool({ data: { sponsoredEnabled: false }, config: {}, api: mockAPI as any });
            expect(tool.getSponsoredText()).toBe('');
        });

        it('should return preset text', () => {
            const tool = new DisclosureTool({
                data: { sponsoredEnabled: true, sponsoredType: 'preset' },
                config: {},
                api: mockAPI as any,
            });
            expect(tool.getSponsoredText()).toBe(SPONSORED_PRESET_TEXT);
        });

        it('should return custom text', () => {
            const tool = new DisclosureTool({
                data: { sponsoredEnabled: true, sponsoredType: 'custom', sponsoredText: 'Paid post.' },
                config: {},
                api: mockAPI as any,
            });
            expect(tool.getSponsoredText()).toBe('Paid post.');
        });

        it('should return empty for custom with blank text', () => {
            const tool = new DisclosureTool({
                data: { sponsoredEnabled: true, sponsoredType: 'custom', sponsoredText: '   ' },
                config: {},
                api: mockAPI as any,
            });
            expect(tool.getSponsoredText()).toBe('');
        });
    });

    describe('Validation', () => {
        it('should fail when both AI and sponsored are disabled', () => {
            const tool = new DisclosureTool({ data: {}, config: {}, api: mockAPI as any });
            expect(tool.validate(tool.save())).toBe(false);
        });

        it('should fail when AI enabled but level is none', () => {
            const tool = new DisclosureTool({
                data: { aiEnabled: true, aiLevel: 'none' },
                config: {},
                api: mockAPI as any,
            });
            expect(tool.validate(tool.save())).toBe(false);
        });

        it('should pass when AI enabled with valid level', () => {
            const tool = new DisclosureTool({
                data: { aiEnabled: true, aiLevel: 'slight' },
                config: {},
                api: mockAPI as any,
            });
            expect(tool.validate(tool.save())).toBe(true);
        });

        it('should pass when sponsored preset enabled', () => {
            const tool = new DisclosureTool({
                data: { sponsoredEnabled: true, sponsoredType: 'preset' },
                config: {},
                api: mockAPI as any,
            });
            expect(tool.validate(tool.save())).toBe(true);
        });

        it('should fail when sponsored custom enabled with empty text', () => {
            const tool = new DisclosureTool({
                data: { sponsoredEnabled: true, sponsoredType: 'custom', sponsoredText: '' },
                config: {},
                api: mockAPI as any,
            });
            expect(tool.validate(tool.save())).toBe(false);
        });

        it('should pass when sponsored custom enabled with valid text', () => {
            const tool = new DisclosureTool({
                data: { sponsoredEnabled: true, sponsoredType: 'custom', sponsoredText: 'Paid partnership.' },
                config: {},
                api: mockAPI as any,
            });
            expect(tool.validate(tool.save())).toBe(true);
        });

        it('should pass when both AI and sponsored are valid', () => {
            const tool = new DisclosureTool({
                data: {
                    aiEnabled: true,
                    aiLevel: 'high',
                    sponsoredEnabled: true,
                    sponsoredType: 'preset',
                },
                config: {},
                api: mockAPI as any,
            });
            expect(tool.validate(tool.save())).toBe(true);
        });
    });

    describe('Constants', () => {
        it('AI_LEVEL_LABELS should have entries for all levels', () => {
            const levels = ['none', 'slight', 'mid', 'high', 'custom'] as const;
            levels.forEach((l) => {
                expect(AI_LEVEL_LABELS[l]).toBeTruthy();
            });
        });

        it('SPONSORED_PRESET_TEXT should be a non-empty string', () => {
            expect(SPONSORED_PRESET_TEXT.length).toBeGreaterThan(10);
        });
    });
});
