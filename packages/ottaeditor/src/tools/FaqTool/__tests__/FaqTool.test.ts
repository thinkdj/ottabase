import { beforeEach, describe, expect, it, vi } from 'vitest';
import FaqTool, { type FaqData } from '../FaqTool';

// Mock CSS import
vi.mock('../FaqTool.css', () => ({}));

const createMockAPI = () => ({
    blocks: {
        getCurrentBlockIndex: vi.fn(() => 0),
    },
});

describe('FaqTool', () => {
    let mockAPI: ReturnType<typeof createMockAPI>;

    beforeEach(() => {
        mockAPI = createMockAPI();
    });

    // ── Static metadata ──────────────────────────────────────────────────────

    describe('Toolbox', () => {
        it('should have correct toolbox title and icon', () => {
            expect(FaqTool.toolbox.title).toBe('FAQ');
            expect(FaqTool.toolbox.icon).toContain('svg');
        });
    });

    describe('enableLineBreaks', () => {
        it('should allow line breaks in answers', () => {
            expect(FaqTool.enableLineBreaks).toBe(true);
        });
    });

    // ── Constructor / default data ────────────────────────────────────────────

    describe('Constructor defaults', () => {
        it('should start with one empty item when no data provided', () => {
            const tool = new FaqTool({ api: mockAPI as any, config: {} });
            const saved = tool.save();
            // Empty items are filtered out on save, so expect an empty array
            expect(saved.items).toHaveLength(0);
            expect(saved.style).toBe('accordion');
        });

        it('should accept defaultStyle from config', () => {
            const tool = new FaqTool({
                api: mockAPI as any,
                config: { defaultStyle: 'flat' },
            });
            expect(tool.save().style).toBe('flat');
        });

        it('should preserve provided data', () => {
            const initialData: FaqData = {
                style: 'flat',
                items: [
                    { question: 'What is it?', answer: 'It is great.' },
                    { question: 'How much?', answer: 'Free.' },
                ],
            };
            const tool = new FaqTool({ api: mockAPI as any, config: {}, data: initialData });
            const saved = tool.save();
            expect(saved.style).toBe('flat');
            expect(saved.items).toHaveLength(2);
            expect(saved.items[0].question).toBe('What is it?');
            expect(saved.items[1].answer).toBe('Free.');
        });
    });

    // ── save / validate ───────────────────────────────────────────────────────

    describe('save()', () => {
        it('should filter out items where both question and answer are empty', () => {
            const tool = new FaqTool({
                api: mockAPI as any,
                config: {},
                data: {
                    style: 'accordion',
                    items: [
                        { question: '', answer: '' },
                        { question: 'Real Q', answer: 'Real A' },
                    ],
                },
            });
            const saved = tool.save();
            expect(saved.items).toHaveLength(1);
            expect(saved.items[0].question).toBe('Real Q');
        });

        it('should trim whitespace from saved items', () => {
            const tool = new FaqTool({
                api: mockAPI as any,
                config: {},
                data: {
                    style: 'accordion',
                    items: [{ question: '  Spaced Q  ', answer: '  Spaced A  ' }],
                },
            });
            const saved = tool.save();
            expect(saved.items[0].question).toBe('Spaced Q');
            expect(saved.items[0].answer).toBe('Spaced A');
        });

        it('should keep items that have only a question (empty answer)', () => {
            const tool = new FaqTool({
                api: mockAPI as any,
                config: {},
                data: {
                    style: 'accordion',
                    items: [{ question: 'Q only', answer: '' }],
                },
            });
            expect(tool.save().items).toHaveLength(1);
        });
    });

    describe('validate()', () => {
        it('should return true when at least one item has a non-empty question', () => {
            const tool = new FaqTool({ api: mockAPI as any, config: {} });
            const result = tool.validate({
                style: 'accordion',
                items: [{ question: 'Does it work?', answer: 'Yes.' }],
            });
            expect(result).toBe(true);
        });

        it('should return false when all items have empty questions', () => {
            const tool = new FaqTool({ api: mockAPI as any, config: {} });
            const result = tool.validate({
                style: 'accordion',
                items: [{ question: '', answer: 'Some answer' }],
            });
            expect(result).toBe(false);
        });

        it('should return false when items array is empty', () => {
            const tool = new FaqTool({ api: mockAPI as any, config: {} });
            const result = tool.validate({ style: 'accordion', items: [] });
            expect(result).toBe(false);
        });
    });

    // ── DOM rendering ──────────────────────────────────────────────────────────

    describe('render()', () => {
        it('should return an HTMLElement', () => {
            const tool = new FaqTool({
                api: mockAPI as any,
                config: {},
                data: {
                    style: 'accordion',
                    items: [{ question: 'Q1', answer: 'A1' }],
                },
            });
            const el = tool.render();
            expect(el).toBeInstanceOf(HTMLElement);
            expect(el.classList.contains('cdx-faq')).toBe(true);
        });

        it('should render one card per item', () => {
            const tool = new FaqTool({
                api: mockAPI as any,
                config: {},
                data: {
                    style: 'accordion',
                    items: [
                        { question: 'Q1', answer: 'A1' },
                        { question: 'Q2', answer: 'A2' },
                    ],
                },
            });
            const el = tool.render();
            const cards = el.querySelectorAll('.cdx-faq__card');
            expect(cards).toHaveLength(2);
        });

        it('should populate question inputs from data', () => {
            const tool = new FaqTool({
                api: mockAPI as any,
                config: {},
                data: {
                    style: 'accordion',
                    items: [{ question: 'Is it good?', answer: 'Very.' }],
                },
            });
            const el = tool.render();
            const qInput = el.querySelector<HTMLInputElement>('.cdx-faq__question-input');
            expect(qInput?.value).toBe('Is it good?');
        });

        it('should render style select with correct selected option', () => {
            const tool = new FaqTool({
                api: mockAPI as any,
                config: {},
                data: { style: 'flat', items: [{ question: 'Q', answer: 'A' }] },
            });
            const el = tool.render();
            const select = el.querySelector<HTMLSelectElement>('.cdx-faq__style-select');
            expect(select?.value).toBe('flat');
        });
    });
});
