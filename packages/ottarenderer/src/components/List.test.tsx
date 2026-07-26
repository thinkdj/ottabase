import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import List from './List';

describe('List Renderer', () => {
    it('renders the nested-list shape with inherited style at every level', () => {
        const { container } = render(
            <List
                data={{
                    style: 'ordered',
                    items: [
                        { content: 'First item', items: [] },
                        {
                            content: 'Second item',
                            items: [{ content: 'Nested item', items: [] }],
                        },
                    ],
                }}
            />,
        );

        expect(container.querySelectorAll('ol').length).toBe(2);
        expect(container.querySelectorAll('ul').length).toBe(0);
        expect(container.textContent).toContain('Nested item');
    });

    it('renders the legacy string-array shape without throwing', () => {
        const { container } = render(<List data={{ style: 'unordered', items: ['Alpha', 'Beta'] }} />);

        const entries = container.querySelectorAll('li');
        expect(entries.length).toBe(2);
        expect(entries[0].textContent).toBe('Alpha');
        expect(entries[1].textContent).toBe('Beta');
    });

    it('tolerates items missing content or nested items', () => {
        const { container } = render(
            // A hand-authored or imported block may omit either field entirely.
            <List data={{ style: 'unordered', items: [{ content: 'Only content' }, {}] }} />,
        );

        expect(container.querySelectorAll('li').length).toBe(2);
        expect(container.textContent).toContain('Only content');
    });

    it('sanitizes inline HTML in item content', () => {
        const { container } = render(
            <List
                data={{
                    style: 'unordered',
                    items: [{ content: '<strong>Bold</strong><script>alert(1)</script>', items: [] }],
                }}
            />,
        );

        expect(container.querySelector('strong')?.textContent).toBe('Bold');
        expect(container.querySelector('script')).toBeNull();
    });
});
