import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SplitPane } from '../components/SplitPane';

describe('SplitPane', () => {
    it('renders with two children', () => {
        render(
            <SplitPane split="vertical" defaultSize="50%">
                <div>Left Pane</div>
                <div>Right Pane</div>
            </SplitPane>,
        );

        expect(screen.getByText('Left Pane')).toBeDefined();
        expect(screen.getByText('Right Pane')).toBeDefined();
    });

    it('renders with vertical split by default', () => {
        const { container } = render(
            <SplitPane defaultSize="50%">
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.style.flexDirection).toBe('row');
    });

    it('renders with horizontal split', () => {
        const { container } = render(
            <SplitPane split="horizontal" defaultSize="50%">
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.style.flexDirection).toBe('column');
    });

    it('applies custom className', () => {
        const { container } = render(
            <SplitPane className="custom-class" defaultSize="50%">
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.classList.contains('custom-class')).toBe(true);
    });

    it('renders resizer with proper role and aria attributes', () => {
        const { container } = render(
            <SplitPane split="vertical" defaultSize="50%">
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        const resizer = container.querySelector('[role="separator"]');
        expect(resizer).toBeDefined();
        expect(resizer?.getAttribute('aria-orientation')).toBe('vertical');
    });

    it('renders resizer with horizontal orientation for horizontal split', () => {
        const { container } = render(
            <SplitPane split="horizontal" defaultSize="50%">
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        const resizer = container.querySelector('[role="separator"]');
        expect(resizer?.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('warns when not exactly 2 children provided', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const { container } = render(
            <SplitPane defaultSize="50%">
                <div>Only one child</div>
            </SplitPane>,
        );

        expect(consoleSpy).toHaveBeenCalledWith('SplitPane requires exactly 2 children');
        expect(container.firstChild).toBeNull();

        consoleSpy.mockRestore();
    });
});
