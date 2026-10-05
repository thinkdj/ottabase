import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CodeBlock } from '../CodeBlock';

const code = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n');

describe('CodeBlock collapsing', () => {
    it('opens on the first lines and shows the rest on request', () => {
        render(<CodeBlock code={code} language="plaintext" collapsible collapsibleThreshold={10} hideHeader />);

        expect(screen.getByText(/line 10/)).not.toBeNull();
        expect(screen.queryByText(/line 11/)).toBeNull();

        const toggle = screen.getByRole('button', { name: 'Show all 30 lines' });
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(toggle);

        expect(screen.getByText(/line 30/)).not.toBeNull();
        expect(screen.getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded')).toBe('true');
    });

    it('never collapses short blocks', () => {
        render(<CodeBlock code={'a\nb'} language="plaintext" collapsible collapsibleThreshold={10} hideHeader />);
        expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
    });
});
