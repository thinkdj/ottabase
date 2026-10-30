import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { API } from '@editorjs/editorjs';
import CodeTool, { type CodeToolData } from './CodeTool';

const tools: CodeTool[] = [];

function create(data: Partial<CodeToolData> = {}) {
    const tool = new CodeTool({ api: {} as API, data, config: {}, block: {} as never, readOnly: false });
    tools.push(tool);
    return tool;
}

function mount(data: Partial<CodeToolData> = {}) {
    const tool = create(data);
    const element = tool.render();
    document.body.appendChild(element);
    return { tool, element };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('CodeTool', () => {
    it('takes its toolbox entry from the registry', () => {
        expect(CodeTool.toolbox.title).toBe('Code');
        expect(CodeTool.toolbox.icon).toContain('<svg');
        expect(CodeTool.enableLineBreaks).toBe(true);
    });

    it('saves code and language with sane defaults', () => {
        expect(create({ code: 'const x = 1;', language: 'typescript' }).save()).toMatchObject({
            code: 'const x = 1;',
            language: 'typescript',
            showLineNumbers: false,
            lineNumberStart: 1,
            tabSize: 4,
            collapsibleThreshold: 20,
            maxHeight: '',
            highlightLines: '',
        });
    });

    it('sanitises lineNumberStart on init and on save', () => {
        expect(create({ code: 'x', lineNumberStart: -5 }).save().lineNumberStart).toBe(1);
        expect(create({ code: 'x', lineNumberStart: 42 }).save().lineNumberStart).toBe(42);
        const { tool } = mount({ code: 'x' });
        fireEvent.input(screen.getByLabelText('First line'), { target: { value: '0' } });
        expect(tool.save().lineNumberStart).toBe(1);
        fireEvent.input(screen.getByLabelText('First line'), { target: { value: '7' } });
        expect(tool.save().lineNumberStart).toBe(7);
    });

    it('opens empty in edit mode with the code textarea, filled in preview', () => {
        const empty = mount();
        expect(empty.element.dataset.mode).toBe('edit');
        expect((screen.getByLabelText('Code') as HTMLTextAreaElement).value).toBe('');
        expect(mount({ code: 'hello', language: 'python' }).element.dataset.mode).toBe('preview');
    });

    it('edits every option through the kit and validates the free-text ones on save', () => {
        const { tool, element } = mount();
        fireEvent.input(screen.getByLabelText('Code'), { target: { value: 'a\nb\nc' } });
        fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'python' } });
        fireEvent.click(screen.getByRole('switch', { name: 'Line numbers' }));
        fireEvent.click(screen.getByRole('switch', { name: 'Wrap long lines' }));
        fireEvent.click(screen.getByRole('switch', { name: 'Hide header' }));
        fireEvent.click(screen.getByRole('switch', { name: 'Hide copy button' }));
        fireEvent.click(screen.getByRole('switch', { name: 'Collapsible' }));
        fireEvent.change(screen.getByLabelText('Tab size'), { target: { value: '2' } });
        fireEvent.input(screen.getByLabelText('Collapse after (lines)'), { target: { value: '3' } }); // below floor → 20
        fireEvent.input(screen.getByLabelText('Max height'), { target: { value: '15rem' } });
        fireEvent.input(screen.getByLabelText('Highlight lines'), { target: { value: '1,2-3' } });
        expect(tool.save()).toEqual({
            code: 'a\nb\nc',
            language: 'python',
            showLineNumbers: true,
            lineNumberStart: 1,
            maxHeight: '15rem',
            wrapLongLines: true,
            hideHeader: true,
            hideCopyButton: true,
            highlightLines: '1,2-3',
            tabSize: 2,
            collapsible: true,
            collapsibleThreshold: 20,
        });
        expect(element.querySelector('.oe-block__summary')?.textContent).toBe('python · 3 lines');
        fireEvent.input(screen.getByLabelText('Max height'), { target: { value: 'tall' } });
        fireEvent.input(screen.getByLabelText('Highlight lines'), { target: { value: 'x-y' } });
        expect(tool.save()).toMatchObject({ maxHeight: '', highlightLines: '' });
    });

    it('supports a custom language identifier', () => {
        const { tool } = mount({ code: 'fn main() {}' });
        const custom = screen.getByLabelText('Custom language') as HTMLInputElement;
        expect(custom.disabled).toBe(true);
        fireEvent.change(screen.getByLabelText('Language'), { target: { value: '__custom__' } });
        expect(custom.disabled).toBe(false);
        fireEvent.input(custom, { target: { value: 'rust' } });
        expect(tool.save().language).toBe('rust');
        // a stored custom language opens with the custom field enabled
        const again = mount({ code: 'x', language: 'kotlin' });
        expect((again.element.querySelector('[aria-label="Custom language"]') as HTMLInputElement).disabled).toBe(
            false,
        );
        expect(again.tool.save().language).toBe('kotlin');
    });
});
