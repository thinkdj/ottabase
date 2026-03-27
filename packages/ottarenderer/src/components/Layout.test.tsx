import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Layout from './Layout';

// Mock Blocks to avoid editorjs-blocks-react-renderer internals; we test Layout structure only
vi.mock('editorjs-blocks-react-renderer', () => ({
    default: ({ data }: { data: { blocks?: Array<{ data?: { text?: string } }> } }) => (
        <div data-testid="blocks-mock">
            {data?.blocks?.map((b, i) => <span key={i}>{b.data?.text ?? ''}</span>) ?? null}
        </div>
    ),
}));

describe('Layout Renderer', () => {
    describe('Presets', () => {
        it('should render 1-1 (50/50) layout with two columns', () => {
            const { container } = render(
                <Layout
                    data={{
                        preset: '1-1',
                        columns: [
                            { content: { blocks: [{ type: 'paragraph', data: { text: 'Left' } }] } },
                            { content: { blocks: [{ type: 'paragraph', data: { text: 'Right' } }] } },
                        ],
                    }}
                />,
            );
            expect(screen.getByText('Left')).toBeTruthy();
            expect(screen.getByText('Right')).toBeTruthy();
            expect(container.querySelector('[data-layout-preset="1-1"]')).toBeTruthy();
        });

        it('should render 1-1-1 layout with three columns', () => {
            const { container } = render(
                <Layout
                    data={{
                        preset: '1-1-1',
                        columns: [
                            { content: { blocks: [{ type: 'paragraph', data: { text: 'A' } }] } },
                            { content: { blocks: [{ type: 'paragraph', data: { text: 'B' } }] } },
                            { content: { blocks: [{ type: 'paragraph', data: { text: 'C' } }] } },
                        ],
                    }}
                />,
            );
            expect(screen.getByText('A')).toBeTruthy();
            expect(screen.getByText('B')).toBeTruthy();
            expect(screen.getByText('C')).toBeTruthy();
            expect(container.querySelector('[data-layout-preset="1-1-1"]')).toBeTruthy();
        });

        it('should default to 1-1 when preset is missing', () => {
            const { container } = render(
                <Layout
                    data={{
                        columns: [
                            { content: { blocks: [{ type: 'paragraph', data: { text: 'Col1' } }] } },
                            { content: { blocks: [] } },
                        ],
                    }}
                />,
            );
            expect(container.querySelector('[data-layout-preset="1-1"]')).toBeTruthy();
        });
    });

    describe('Empty columns', () => {
        it('should render placeholder for empty column', () => {
            const { container } = render(
                <Layout
                    data={{
                        preset: '1-1',
                        columns: [
                            { content: { blocks: [{ type: 'paragraph', data: { text: 'Has content' } }] } },
                            { content: { blocks: [] } },
                        ],
                    }}
                />,
            );
            expect(screen.getByText('Has content')).toBeTruthy();
            const placeholders = container.querySelectorAll('.border-dashed');
            expect(placeholders.length).toBe(1);
        });

        it('should render placeholder when column has no content', () => {
            const { container } = render(
                <Layout
                    data={{
                        preset: '1-1',
                        columns: [{}, {}],
                    }}
                />,
            );
            const placeholders = container.querySelectorAll('.border-dashed');
            expect(placeholders.length).toBe(2);
        });
    });

    describe('Edge cases', () => {
        it('should return null when columns is empty', () => {
            const { container } = render(<Layout data={{ preset: '1-1', columns: [] }} />);
            expect(container.querySelector('.cdc-content-layout')).toBeFalsy();
        });

        it('should return null when data is empty', () => {
            const { container } = render(<Layout data={{}} />);
            expect(container.querySelector('.cdc-content-layout')).toBeFalsy();
        });

        it('should have aria-label for accessibility', () => {
            render(
                <Layout
                    data={{
                        preset: '1-2',
                        columns: [
                            { content: { blocks: [{ type: 'paragraph', data: { text: 'X' } }] } },
                            { content: { blocks: [] } },
                        ],
                    }}
                />,
            );
            expect(screen.getByRole('region', { name: /1-2 column layout/ })).toBeTruthy();
        });
    });
});
