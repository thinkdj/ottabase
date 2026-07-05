import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

describe('MarkdownRenderer — blockquote code block reindexing', () => {
    it('renders correct code in blockquotes when outer code blocks exist (simple mode)', () => {
        const md = ['```js', 'const outer = 1;', '```', '', '> ```py', '> inner_val = 2', '> ```'].join('\n');

        const { container } = render(<MarkdownRenderer content={md} codeRenderMode="simple" />);

        // Simple mode: code blocks are rendered as React components with otta-docs-code-enhanced class
        const codeBlocks = container.querySelectorAll('.otta-docs-code-enhanced code');
        expect(codeBlocks).toHaveLength(2);
        expect(codeBlocks[0].textContent).toBe('const outer = 1;');
        expect(codeBlocks[1].textContent).toBe('inner_val = 2');
    });

    it('renders correct code in blockquotes when outer code blocks exist (plain mode)', () => {
        const md = ['```js', 'const outer = 1;', '```', '', '> ```py', '> inner_val = 2', '> ```'].join('\n');

        const { container } = render(<MarkdownRenderer content={md} codeRenderMode="plain" />);

        // Plain mode: code blocks in regular divs
        const codeElements = container.querySelectorAll('.otta-docs-code-block code');
        expect(codeElements).toHaveLength(2);
        expect(codeElements[0].textContent).toBe('const outer = 1;');
        expect(codeElements[1].textContent).toBe('inner_val = 2');
    });

    it('handles multiple code blocks before and inside a blockquote', () => {
        const md = [
            '```js',
            'first();',
            '```',
            '',
            '```ts',
            'second();',
            '```',
            '',
            '> ```bash',
            '> echo "third"',
            '> ```',
        ].join('\n');

        const { container } = render(<MarkdownRenderer content={md} codeRenderMode="simple" />);

        const codeBlocks = container.querySelectorAll('.otta-docs-code-enhanced code');
        expect(codeBlocks).toHaveLength(3);
        expect(codeBlocks[0].textContent).toBe('first();');
        expect(codeBlocks[1].textContent).toBe('second();');
        expect(codeBlocks[2].textContent).toBe('echo "third"');
    });
});

describe('MarkdownRenderer — inline code protects markdown syntax', () => {
    it('does not italicize underscores inside inline code', () => {
        const md = 'Bindings: `OBCF_ANALYTICS_CORE`, `OBCF_ANALYTICS_SHORTLINKS`.';

        const { container } = render(<MarkdownRenderer content={md} />);

        const codes = container.querySelectorAll('.otta-docs-inline-code');
        expect(codes).toHaveLength(2);
        expect(codes[0].textContent).toBe('OBCF_ANALYTICS_CORE');
        expect(codes[1].textContent).toBe('OBCF_ANALYTICS_SHORTLINKS');
        // The underscores must NOT have produced <em> inside the code spans.
        expect(container.querySelector('.otta-docs-inline-code em')).toBeNull();
    });

    it('keeps inline code intact inside table cells', () => {
        const md = ['| Binding | Note |', '| --- | --- |', '| `OBCF_ANALYTICS_CORE` | Event tracking |'].join('\n');

        const { container } = render(<MarkdownRenderer content={md} />);

        const code = container.querySelector('.otta-docs-table .otta-docs-inline-code');
        expect(code?.textContent).toBe('OBCF_ANALYTICS_CORE');
        expect(code?.querySelector('em')).toBeNull();
    });

    it('still applies emphasis outside inline code', () => {
        const md = 'Set _the_ `X_Y` value.';

        const { container } = render(<MarkdownRenderer content={md} />);

        // Prose emphasis still works…
        expect(container.querySelector('em')?.textContent).toBe('the');
        // …but the underscore inside the code is preserved.
        expect(container.querySelector('.otta-docs-inline-code')?.textContent).toBe('X_Y');
    });
});
