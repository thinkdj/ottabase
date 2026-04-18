import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import React from 'react';
import References from './References';

describe('References Renderer', () => {
    // ── Null / empty guards ────────────────────────────────────────────────────

    it('should render null for undefined data', () => {
        const { container } = render(<References data={undefined as any} />);
        expect(container.firstChild).toBeNull();
    });

    it('should render null when items array is empty', () => {
        const { container } = render(<References data={{ items: [], style: 'numbered' }} />);
        expect(container.firstChild).toBeNull();
    });

    it('should render null when all items have empty URLs', () => {
        const { container } = render(
            <References data={{ items: [{ id: '1', url: '', title: 'No URL' }], style: 'numbered' }} />,
        );
        expect(container.firstChild).toBeNull();
    });

    // ── Numbered style ────────────────────────────────────────────────────────

    describe('Numbered style', () => {
        const baseData = {
            style: 'numbered' as const,
            items: [
                { id: '1', url: 'https://example.com', title: 'Example Site', authors: 'Jane Doe', year: '2024' },
                { id: '2', url: 'https://editorjs.io', title: 'EditorJS', year: '2023' },
            ],
        };

        it('should render an <ol> element for numbered style', () => {
            const { container } = render(<References data={baseData} />);
            expect(container.querySelector('ol')).toBeTruthy();
        });

        it('should render the correct number of list items', () => {
            const { container } = render(<References data={baseData} />);
            const items = container.querySelectorAll('.cdc-references-item');
            expect(items).toHaveLength(2);
        });

        it('should render [1] label for numbered style', () => {
            const { container } = render(<References data={baseData} />);
            const labels = container.querySelectorAll('.cdc-references-label');
            expect(labels[0].textContent).toBe('[1]');
            expect(labels[1].textContent).toBe('[2]');
        });

        it('should render linked title when title is provided', () => {
            render(<References data={baseData} />);
            const link = screen.getByText('Example Site');
            expect(link.tagName.toLowerCase()).toBe('a');
            expect(link.getAttribute('href')).toBe('https://example.com');
        });

        it('should render authors and year', () => {
            const { container } = render(<References data={baseData} />);
            expect(container.querySelector('.cdc-references-authors')?.textContent).toBe('Jane Doe');
            expect(container.querySelector('.cdc-references-year')?.textContent).toBe(' (2024)');
        });

        it('should open links in a new tab', () => {
            render(<References data={baseData} />);
            const link = screen.getByText('Example Site') as HTMLAnchorElement;
            expect(link.getAttribute('target')).toBe('_blank');
            expect(link.getAttribute('rel')).toBe('noopener noreferrer');
        });

        it('should render the cdc-references container class', () => {
            const { container } = render(<References data={baseData} />);
            expect(container.querySelector('.cdc-references')).toBeTruthy();
            expect(container.querySelector('.cdc-references--numbered')).toBeTruthy();
        });
    });

    // ── Footnote style ─────────────────────────────────────────────────────────

    describe('Footnote style', () => {
        const footnoteData = {
            style: 'footnote' as const,
            items: [{ id: '1', url: 'https://example.com', title: 'Example' }],
        };

        it('should render a <ul> element for footnote style', () => {
            const { container } = render(<References data={footnoteData} />);
            expect(container.querySelector('ul')).toBeTruthy();
        });

        it('should render plain superscript-style label (no brackets)', () => {
            const { container } = render(<References data={footnoteData} />);
            const label = container.querySelector('.cdc-references-label');
            expect(label?.textContent).toBe('1');
        });

        it('should render cdc-references--footnote class', () => {
            const { container } = render(<References data={footnoteData} />);
            expect(container.querySelector('.cdc-references--footnote')).toBeTruthy();
        });
    });

    // ── URL fallback ──────────────────────────────────────────────────────────

    it('should render the URL as link text when title is absent', () => {
        const { container } = render(
            <References data={{ items: [{ id: '1', url: 'https://example.com/article' }], style: 'numbered' }} />,
        );
        const link = container.querySelector('.cdc-references-link');
        expect(link?.getAttribute('href')).toBe('https://example.com/article');
        // Title is absent so link text shows the cleaned URL
        expect(link?.textContent).toContain('example.com');
    });

    // ── Optional fields ────────────────────────────────────────────────────────

    it('should render accessedDate when provided', () => {
        const { container } = render(
            <References
                data={{
                    items: [{ id: '1', url: 'https://example.com', accessedDate: '2024-01-15' }],
                    style: 'numbered',
                }}
            />,
        );
        expect(container.querySelector('.cdc-references-accessed')?.textContent).toContain('2024-01-15');
    });

    it('should render note when provided', () => {
        const { container } = render(
            <References
                data={{
                    items: [{ id: '1', url: 'https://example.com', note: 'Very useful resource' }],
                    style: 'numbered',
                }}
            />,
        );
        expect(container.querySelector('.cdc-references-note')?.textContent).toContain('Very useful resource');
    });

    // ── className passthrough ──────────────────────────────────────────────────

    it('should apply extra className to the container', () => {
        const { container } = render(
            <References
                data={{ items: [{ id: '1', url: 'https://example.com' }], style: 'numbered' }}
                className="custom-class"
            />,
        );
        const wrapper = container.querySelector('.cdc-references');
        expect(wrapper?.className).toContain('custom-class');
    });

    // ── Default style ─────────────────────────────────────────────────────────

    it('should default to numbered style when style is not specified', () => {
        const { container } = render(<References data={{ items: [{ id: '1', url: 'https://example.com' }] }} />);
        expect(container.querySelector('ol')).toBeTruthy();
    });
});
