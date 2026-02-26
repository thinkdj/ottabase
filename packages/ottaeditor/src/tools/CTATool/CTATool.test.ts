import { beforeEach, describe, expect, it, vi } from 'vitest';
import CTATool from './CTATool';

// Mock CSS import
vi.mock('./CTATool.css', () => ({}));

// Mock EditorJS API
const createMockAPI = () => ({
    blocks: {
        getCurrentBlockIndex: vi.fn(() => 0),
    },
    ui: {
        notifier: {
            show: vi.fn(),
        },
    },
});

describe('CTATool', () => {
    let tool: CTATool;
    let mockAPI: ReturnType<typeof createMockAPI>;

    beforeEach(() => {
        mockAPI = createMockAPI();
        tool = new CTATool({
            data: {},
            config: {},
            api: mockAPI as any,
        });
    });

    describe('Toolbox', () => {
        it('should have correct toolbox configuration', () => {
            expect(CTATool.toolbox.title).toBe('Call to Action');
            expect(CTATool.toolbox.icon).toBeTruthy();
        });

        it('should enable line breaks', () => {
            expect(CTATool.enableLineBreaks).toBe(true);
        });
    });

    describe('Initialization', () => {
        it('should initialize with default values', () => {
            const defaultTool = new CTATool({
                data: {},
                config: {},
                api: mockAPI as any,
            });

            const saved = defaultTool.save();
            expect(saved.text).toBe('Get Started');
            expect(saved.url).toBe('');
            expect(saved.style).toBe('primary');
            expect(saved.alignment).toBe('center');
            expect(saved.openInNewTab).toBe(false);
        });

        it('should initialize with provided data', () => {
            const customTool = new CTATool({
                data: {
                    text: 'Sign Up',
                    url: 'https://example.com',
                    style: 'secondary',
                    alignment: 'left',
                    openInNewTab: true,
                },
                config: {},
                api: mockAPI as any,
            });

            const saved = customTool.save();
            expect(saved.text).toBe('Sign Up');
            expect(saved.url).toBe('https://example.com');
            expect(saved.style).toBe('secondary');
            expect(saved.alignment).toBe('left');
            expect(saved.openInNewTab).toBe(true);
        });

        it('should use config default style', () => {
            const toolWithConfig = new CTATool({
                data: {},
                config: { defaultStyle: 'outline' },
                api: mockAPI as any,
            });

            const saved = toolWithConfig.save();
            expect(saved.style).toBe('outline');
        });

        it('should use config default alignment', () => {
            const toolWithConfig = new CTATool({
                data: {},
                config: { defaultAlignment: 'right' },
                api: mockAPI as any,
            });

            const saved = toolWithConfig.save();
            expect(saved.alignment).toBe('right');
        });
    });

    describe('Rendering', () => {
        it('should render wrapper element', () => {
            const element = tool.render();
            expect(element).toBeInstanceOf(HTMLElement);
            expect(element.classList.contains('cdx-cta')).toBe(true);
            expect(element.classList.contains('cdx-cta__wrapper')).toBe(true);
        });

        it('should render form with all inputs', () => {
            const element = tool.render();
            const form = element.querySelector('.cdx-cta__form');
            expect(form).toBeTruthy();

            expect(element.querySelector('[id^="cta-text-"]')).toBeTruthy();
            expect(element.querySelector('[id^="cta-url-"]')).toBeTruthy();
            expect(element.querySelector('[id^="cta-style-"]')).toBeTruthy();
            expect(element.querySelector('[id^="cta-new-tab-"]')).toBeTruthy();
        });

        it('should render alignment buttons', () => {
            const element = tool.render();
            const alignBtns = element.querySelectorAll('.cdx-cta__align-btn');
            expect(alignBtns.length).toBe(3);
        });

        it('should render preview button', () => {
            const element = tool.render();
            const preview = element.querySelector('.cdx-cta__preview');
            const previewButton = element.querySelector('.cdx-cta__preview-button');

            expect(preview).toBeTruthy();
            expect(previewButton).toBeTruthy();
        });

        it('should update preview when text changes', () => {
            const element = tool.render();
            const textInput = element.querySelector('[id^="cta-text-"]') as HTMLInputElement;
            const previewButton = element.querySelector('.cdx-cta__preview-button') as HTMLAnchorElement;

            textInput.value = 'New Button Text';
            textInput.dispatchEvent(new Event('input'));

            expect(previewButton.textContent).toBe('New Button Text');
        });

        it('should update preview when URL changes', () => {
            const element = tool.render();
            const urlInput = element.querySelector('[id^="cta-url-"]') as HTMLInputElement;
            const previewButton = element.querySelector('.cdx-cta__preview-button') as HTMLAnchorElement;

            urlInput.value = 'https://example.com';
            urlInput.dispatchEvent(new Event('input'));

            expect(previewButton.href).toContain('https://example.com');
        });

        it('should update preview when style changes', () => {
            const element = tool.render();
            const styleSelect = element.querySelector('[id^="cta-style-"]') as HTMLSelectElement;
            const previewButton = element.querySelector('.cdx-cta__preview-button') as HTMLAnchorElement;

            styleSelect.value = 'outline';
            styleSelect.dispatchEvent(new Event('change'));

            expect(previewButton.classList.contains('cdx-cta__preview-button--outline')).toBe(true);
        });

        it('should update target when checkbox changes', () => {
            const element = tool.render();
            const checkbox = element.querySelector('[id^="cta-new-tab-"]') as HTMLInputElement;
            const previewButton = element.querySelector('.cdx-cta__preview-button') as HTMLAnchorElement;

            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));

            expect(previewButton.target).toBe('_blank');
            expect(previewButton.rel).toBe('noopener noreferrer');
        });

        it('should update alignment when alignment button clicked', () => {
            const element = tool.render();
            const leftBtn = element.querySelector('.cdx-cta__align-btn[data-align="left"]') as HTMLButtonElement;

            leftBtn.click();

            const saved = tool.save();
            expect(saved.alignment).toBe('left');
        });

        it('should mark active alignment button', () => {
            const element = tool.render();
            const centerBtn = element.querySelector('.cdx-cta__align-btn[data-align="center"]') as HTMLButtonElement;
            // Default is center
            expect(centerBtn.classList.contains('cdx-cta__align-btn--active')).toBe(true);

            const rightBtn = element.querySelector('.cdx-cta__align-btn[data-align="right"]') as HTMLButtonElement;
            rightBtn.click();
            expect(rightBtn.classList.contains('cdx-cta__align-btn--active')).toBe(true);
            expect(centerBtn.classList.contains('cdx-cta__align-btn--active')).toBe(false);
        });
    });

    describe('Save', () => {
        it('should save current data', () => {
            const element = tool.render();
            const textInput = element.querySelector('[id^="cta-text-"]') as HTMLInputElement;
            const urlInput = element.querySelector('[id^="cta-url-"]') as HTMLInputElement;

            textInput.value = 'Click Here';
            textInput.dispatchEvent(new Event('input'));

            urlInput.value = 'https://test.com';
            urlInput.dispatchEvent(new Event('input'));

            const saved = tool.save();
            expect(saved.text).toBe('Click Here');
            expect(saved.url).toBe('https://test.com');
        });

        it('should save alignment', () => {
            const element = tool.render();
            const leftBtn = element.querySelector('.cdx-cta__align-btn[data-align="left"]') as HTMLButtonElement;
            leftBtn.click();

            const saved = tool.save();
            expect(saved.alignment).toBe('left');
        });
    });

    describe('Validation', () => {
        it('should validate when text and URL are provided', () => {
            const validTool = new CTATool({
                data: {
                    text: 'Button',
                    url: 'https://example.com',
                },
                config: {},
                api: mockAPI as any,
            });

            expect(validTool.validate(validTool.save())).toBe(true);
        });

        it('should fail validation when text is empty', () => {
            const invalidTool = new CTATool({
                data: {
                    text: '',
                    url: 'https://example.com',
                },
                config: {},
                api: mockAPI as any,
            });

            const saved = invalidTool.save();
            saved.text = '';
            expect(invalidTool.validate(saved)).toBe(false);
        });

        it('should fail validation when URL is empty', () => {
            const invalidTool = new CTATool({
                data: {
                    text: 'Button',
                    url: '',
                },
                config: {},
                api: mockAPI as any,
            });

            expect(invalidTool.validate(invalidTool.save())).toBe(false);
        });

        it('should fail validation when text is only whitespace', () => {
            const invalidTool = new CTATool({
                data: {
                    text: '   ',
                    url: 'https://example.com',
                },
                config: {},
                api: mockAPI as any,
            });

            expect(invalidTool.validate(invalidTool.save())).toBe(false);
        });
    });

    describe('Style Options', () => {
        it('should support primary style', () => {
            const t = new CTATool({ data: { style: 'primary' }, config: {}, api: mockAPI as any });
            const element = t.render();
            const previewButton = element.querySelector('.cdx-cta__preview-button') as HTMLAnchorElement;
            expect(previewButton.classList.contains('cdx-cta__preview-button--primary')).toBe(true);
        });

        it('should support secondary style', () => {
            const t = new CTATool({ data: { style: 'secondary' }, config: {}, api: mockAPI as any });
            const element = t.render();
            const previewButton = element.querySelector('.cdx-cta__preview-button') as HTMLAnchorElement;
            expect(previewButton.classList.contains('cdx-cta__preview-button--secondary')).toBe(true);
        });

        it('should support outline style', () => {
            const t = new CTATool({ data: { style: 'outline' }, config: {}, api: mockAPI as any });
            const element = t.render();
            const previewButton = element.querySelector('.cdx-cta__preview-button') as HTMLAnchorElement;
            expect(previewButton.classList.contains('cdx-cta__preview-button--outline')).toBe(true);
        });

        it('should support ghost style', () => {
            const t = new CTATool({ data: { style: 'ghost' }, config: {}, api: mockAPI as any });
            const element = t.render();
            const previewButton = element.querySelector('.cdx-cta__preview-button') as HTMLAnchorElement;
            expect(previewButton.classList.contains('cdx-cta__preview-button--ghost')).toBe(true);
        });
    });

    describe('Alignment Options', () => {
        it('should support left alignment', () => {
            const t = new CTATool({ data: { alignment: 'left' }, config: {}, api: mockAPI as any });
            const saved = t.save();
            expect(saved.alignment).toBe('left');
        });

        it('should support center alignment', () => {
            const t = new CTATool({ data: { alignment: 'center' }, config: {}, api: mockAPI as any });
            const saved = t.save();
            expect(saved.alignment).toBe('center');
        });

        it('should support right alignment', () => {
            const t = new CTATool({ data: { alignment: 'right' }, config: {}, api: mockAPI as any });
            const saved = t.save();
            expect(saved.alignment).toBe('right');
        });
    });
});
