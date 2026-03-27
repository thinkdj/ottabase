import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CodeBlock } from '../CodeBlock';

describe('CodeBlock', () => {
    describe('line number validation', () => {
        it('uses lineNumberStart 1 when not set', () => {
            const { container } = render(<CodeBlock code={'line 1\nline 2'} language="plaintext" showLineNumbers />);
            const lineNums = container.querySelectorAll('.code-block-line-num');
            expect(lineNums.length).toBeGreaterThanOrEqual(1);
            expect(lineNums[0].textContent).toBe('1');
        });

        it('uses lineNumberStart 1 when 0 is passed', () => {
            const { container } = render(
                <CodeBlock code={'a\nb'} language="plaintext" showLineNumbers lineNumberStart={0} />,
            );
            const lineNums = container.querySelectorAll('.code-block-line-num');
            expect(lineNums[0].textContent).toBe('1');
        });

        it('uses lineNumberStart 1 when NaN/invalid is passed', () => {
            const { container } = render(
                <CodeBlock code="x" language="plaintext" showLineNumbers lineNumberStart={NaN as any} />,
            );
            const lineNums = container.querySelectorAll('.code-block-line-num');
            expect(lineNums[0].textContent).toBe('1');
        });

        it('respects valid lineNumberStart', () => {
            const { container } = render(
                <CodeBlock code={'a\nb\nc'} language="plaintext" showLineNumbers lineNumberStart={42} />,
            );
            const lineNums = container.querySelectorAll('.code-block-line-num');
            expect(lineNums.length).toBeGreaterThanOrEqual(2);
            expect(lineNums[0].textContent).toBe('42');
            expect(lineNums[1].textContent).toBe('43');
        });
    });

    describe('line numbers scroll with code', () => {
        it('renders line numbers inline with code (not absolute overlay)', () => {
            const { container } = render(<CodeBlock code={'one\ntwo\nthree'} language="plaintext" showLineNumbers />);
            const pre = container.querySelector('.code-block-with-lines');
            expect(pre).toBeTruthy();
            const lines = pre?.querySelectorAll('.code-block-line');
            expect(lines?.length).toBeGreaterThanOrEqual(1);
            const firstNum = lines?.[0]?.querySelector('.code-block-line-num');
            expect(firstNum).toBeTruthy();
            expect(firstNum?.textContent).toBe('1');
        });
    });

    describe('basic rendering', () => {
        it('renders code without line numbers', () => {
            const code = 'const x = 1;';
            render(<CodeBlock code={code} />);
            expect(screen.getByText(code)).toBeTruthy();
        });

        it('renders header with language when not plaintext', () => {
            render(<CodeBlock code="x" language="typescript" />);
            expect(screen.getByText(/typescript/i)).toBeTruthy();
        });

        it('renders filename when provided', () => {
            render(<CodeBlock code="x" filename="test.ts" />);
            expect(screen.getByText('test.ts')).toBeTruthy();
        });

        it('hides header when hideHeader is true', () => {
            const { container } = render(<CodeBlock code="x" language="typescript" hideHeader />);
            expect(container.querySelector('.code-block-header')).toBeNull();
        });
    });

    describe('highlight lines', () => {
        it('applies highlight class when highlightLines specified', () => {
            const { container } = render(
                <CodeBlock code={'a\nb\nc\nd'} language="plaintext" showLineNumbers highlightLines="2,4" />,
            );
            const highlighted = container.querySelectorAll('.code-block-line-num.code-line-highlight');
            expect(highlighted.length).toBeGreaterThanOrEqual(1);
        });

        it('supports range syntax in highlightLines', () => {
            const { container } = render(
                <CodeBlock code={'a\nb\nc\nd\ne'} language="plaintext" showLineNumbers highlightLines="2-4" />,
            );
            const highlighted = container.querySelectorAll('.code-block-line-num.code-line-highlight');
            expect(highlighted.length).toBeGreaterThanOrEqual(1);
        });
    });
});
