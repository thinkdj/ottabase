import { beforeEach, describe, expect, it, vi } from 'vitest';
import CodeTool, { type CodeToolData } from './CodeTool';

const createMockAPI = () => ({
    blocks: { getCurrentBlockIndex: vi.fn(() => 0) },
    ui: { notifier: { show: vi.fn() } },
});

describe('CodeTool', () => {
    let tool: CodeTool;

    beforeEach(() => {
        tool = new CodeTool({
            data: {},
            config: {},
            api: createMockAPI() as any,
        });
    });

    describe('toolbox', () => {
        it('has correct toolbox config', () => {
            expect(CodeTool.toolbox.title).toBe('Code');
            expect(CodeTool.toolbox.icon).toBeTruthy();
        });

        it('enables line breaks', () => {
            expect(CodeTool.enableLineBreaks).toBe(true);
        });
    });

    describe('lineNumberStart validation', () => {
        it('defaults to 1 when not set', () => {
            const t = new CodeTool({ data: {}, config: {}, api: createMockAPI() as any });
            expect(t.save().lineNumberStart).toBe(1);
        });

        it('sanitizes 0 to 1', () => {
            const t = new CodeTool({
                data: { code: 'x', lineNumberStart: 0 },
                config: {},
                api: createMockAPI() as any,
            });
            const el = t.render();
            const startInput = el.querySelector<HTMLInputElement>('[data-code-opt="lineStart"]');
            startInput!.value = '0';
            startInput!.dispatchEvent(new Event('input'));
            expect(t.save().lineNumberStart).toBe(1);
        });

        it('sanitizes invalid to 1 on init', () => {
            const t = new CodeTool({
                data: { code: 'x', lineNumberStart: -5 },
                config: {},
                api: createMockAPI() as any,
            });
            expect(t.save().lineNumberStart).toBe(1);
        });

        it('preserves valid lineNumberStart', () => {
            const t = new CodeTool({
                data: { code: 'x', lineNumberStart: 42 },
                config: {},
                api: createMockAPI() as any,
            });
            t.render(); // DOM must exist for save() to read values
            expect(t.save().lineNumberStart).toBe(42);
        });
    });

    describe('save', () => {
        it('returns code and language', () => {
            const t = new CodeTool({
                data: { code: 'const x = 1;', language: 'typescript' },
                config: {},
                api: createMockAPI() as any,
            });
            const saved = t.save();
            expect(saved.code).toBe('const x = 1;');
            expect(saved.language).toBe('typescript');
        });

        it('validates lineNumberStart on save', () => {
            tool.render();
            const startInput = tool['wrapper']?.querySelector<HTMLInputElement>('[data-code-opt="lineStart"]');
            startInput!.value = '0';
            startInput!.dispatchEvent(new Event('input'));
            expect(tool.save().lineNumberStart).toBe(1);
        });
    });

    describe('render', () => {
        it('renders textarea with code', () => {
            const el = tool.render();
            const textarea = el.querySelector('textarea');
            expect(textarea).toBeTruthy();
            expect(textarea?.value).toBe('');
        });

        it('renders with existing data', () => {
            const t = new CodeTool({
                data: { code: 'hello', language: 'python' },
                config: {},
                api: createMockAPI() as any,
            });
            const el = t.render();
            const textarea = el.querySelector('textarea');
            expect(textarea?.value).toBe('hello');
        });
    });
});
