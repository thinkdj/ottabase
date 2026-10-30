import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OttaRenderer } from '../OttaRenderer';
import type { LayoutData } from './Layout';

const layout = (data: LayoutData) => <OttaRenderer data={{ blocks: [{ id: 'l', type: 'layout', data }] }} />;
const para = (text: string) => ({ content: { blocks: [{ type: 'paragraph', data: { text } }] } });

describe('Layout', () => {
    it('renders two columns for 1-1 with real nested blocks', () => {
        const { container } = render(layout({ preset: '1-1', columns: [para('Left'), para('Right')] }));
        expect(screen.getByText('Left').closest('p')?.className).toContain('otta-paragraph');
        expect(screen.getByText('Right')).toBeTruthy();
        expect(container.querySelector('[data-layout-preset="1-1"]')).toBeTruthy();
        expect(container.querySelectorAll('.otta-layout__column').length).toBe(2);
    });

    it('renders three columns for 1-1-1', () => {
        const { container } = render(layout({ preset: '1-1-1', columns: [para('A'), para('B'), para('C')] }));
        expect(container.querySelectorAll('.otta-layout__column').length).toBe(3);
        expect(screen.getByText('C')).toBeTruthy();
    });

    it('falls back to 1-1 for a missing or unknown preset', () => {
        const { container } = render(
            layout({ preset: 'bogus' as LayoutData['preset'], columns: [para('X'), para('Y')] }),
        );
        expect(container.querySelector('[data-layout-preset="1-1"]')).toBeTruthy();
    });

    it('shows a placeholder for an empty column', () => {
        const { container } = render(
            layout({ preset: '1-1', columns: [para('Has content'), { content: { blocks: [] } }] }),
        );
        expect(container.querySelectorAll('.otta-layout__empty').length).toBe(1);
        const { container: both } = render(layout({ preset: '1-1', columns: [{}, {}] }));
        expect(both.querySelectorAll('.otta-layout__empty').length).toBe(2);
    });

    it('renders nothing without columns', () => {
        const { container } = render(layout({ preset: '1-1', columns: [] }));
        expect(container.querySelector('.otta-layout')).toBeNull();
    });

    it('shares heading ids with the document so a duplicate heading gets a suffix', () => {
        const { container } = render(
            <OttaRenderer
                data={{
                    blocks: [
                        { type: 'header', data: { text: 'Intro', level: 2 } },
                        {
                            type: 'layout',
                            data: {
                                preset: '1-1',
                                columns: [
                                    { content: { blocks: [{ type: 'header', data: { text: 'Intro', level: 3 } }] } },
                                    para('x'),
                                ],
                            },
                        },
                    ],
                }}
            />,
        );
        expect(container.querySelector('h2')?.id).toBe('intro');
        expect(container.querySelector('h3')?.id).toBe('intro-2');
    });
});
