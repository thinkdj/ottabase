import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SplitPane } from '../components/SplitPane';

// Test helper to mock getBoundingClientRect
function mockContainerRect(wrapper: HTMLElement, width = 800, height = 600) {
    wrapper.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width,
        height,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }),
    }));
}

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
        expect(resizer?.getAttribute('aria-valuenow')).toBeDefined();
        expect(resizer?.getAttribute('aria-valuemin')).toBeDefined();
        expect(resizer?.getAttribute('aria-valuemax')).toBeDefined();
        expect(resizer?.getAttribute('aria-valuetext')).toBeDefined();
        expect(resizer?.getAttribute('tabIndex')).toBe('0');
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

    it('handles mouse drag to resize panes', () => {
        const { container } = render(
            <SplitPane split="vertical" defaultSize={200}>
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        const resizer = container.querySelector('[role="separator"]') as HTMLElement;
        const wrapper = container.firstChild as HTMLElement;

        // Mock getBoundingClientRect
        mockContainerRect(wrapper);

        // Start dragging
        fireEvent.mouseDown(resizer);

        // Move mouse
        fireEvent.mouseMove(document, {
            clientX: 300,
            clientY: 0,
        });

        // Get the pane1 element
        const pane1 = wrapper.children[0] as HTMLElement;

        // Verify the width changed
        expect(pane1.style.width).toBe('300px');

        // Stop dragging
        fireEvent.mouseUp(document);
    });

    it('calls onChange callback when resizing', () => {
        const onChange = vi.fn();
        const { container } = render(
            <SplitPane split="vertical" defaultSize={200} onChange={onChange}>
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        const resizer = container.querySelector('[role="separator"]') as HTMLElement;
        const wrapper = container.firstChild as HTMLElement;

        mockContainerRect(wrapper);

        fireEvent.mouseDown(resizer);
        fireEvent.mouseMove(document, {
            clientX: 300,
            clientY: 0,
        });

        expect(onChange).toHaveBeenCalledWith(300);

        fireEvent.mouseUp(document);
    });

    it('respects minSize constraint', () => {
        const { container } = render(
            <SplitPane split="vertical" defaultSize={200} minSize={100}>
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        const resizer = container.querySelector('[role="separator"]') as HTMLElement;
        const wrapper = container.firstChild as HTMLElement;

        mockContainerRect(wrapper);

        fireEvent.mouseDown(resizer);
        // Try to resize below minSize
        fireEvent.mouseMove(document, {
            clientX: 50,
            clientY: 0,
        });

        const pane1 = wrapper.children[0] as HTMLElement;
        // Should be clamped to minSize
        expect(pane1.style.width).toBe('100px');

        fireEvent.mouseUp(document);
    });

    it('respects maxSize constraint', () => {
        const { container } = render(
            <SplitPane split="vertical" defaultSize={200} maxSize={400}>
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        const resizer = container.querySelector('[role="separator"]') as HTMLElement;
        const wrapper = container.firstChild as HTMLElement;

        mockContainerRect(wrapper);

        fireEvent.mouseDown(resizer);
        // Try to resize above maxSize
        fireEvent.mouseMove(document, {
            clientX: 600,
            clientY: 0,
        });

        const pane1 = wrapper.children[0] as HTMLElement;
        // Should be clamped to maxSize
        expect(pane1.style.width).toBe('400px');

        fireEvent.mouseUp(document);
    });

    it('snaps to snap points when within threshold', () => {
        const { container } = render(
            <SplitPane split="vertical" defaultSize={200} snapPoints={[300, 500]} snapThreshold={20}>
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        const resizer = container.querySelector('[role="separator"]') as HTMLElement;
        const wrapper = container.firstChild as HTMLElement;

        mockContainerRect(wrapper);

        fireEvent.mouseDown(resizer);
        // Move to 310, which is within threshold of snap point 300
        fireEvent.mouseMove(document, {
            clientX: 310,
            clientY: 0,
        });

        const pane1 = wrapper.children[0] as HTMLElement;
        // Should snap to 300
        expect(pane1.style.width).toBe('300px');

        fireEvent.mouseUp(document);
    });

    it('handles keyboard navigation - arrow keys', () => {
        const { container } = render(
            <SplitPane split="vertical" defaultSize={200}>
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        const resizer = container.querySelector('[role="separator"]') as HTMLElement;
        const wrapper = container.firstChild as HTMLElement;
        const pane1 = wrapper.children[0] as HTMLElement;

        mockContainerRect(wrapper);

        // Press ArrowRight to increase size
        fireEvent.keyDown(resizer, { key: 'ArrowRight' });
        expect(pane1.style.width).toBe('210px');

        // Press ArrowLeft to decrease size
        fireEvent.keyDown(resizer, { key: 'ArrowLeft' });
        expect(pane1.style.width).toBe('200px');
    });

    it('handles keyboard navigation - Home and End keys', () => {
        const { container } = render(
            <SplitPane split="vertical" defaultSize={200} minSize={100} maxSize={500}>
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        const resizer = container.querySelector('[role="separator"]') as HTMLElement;
        const wrapper = container.firstChild as HTMLElement;
        const pane1 = wrapper.children[0] as HTMLElement;

        mockContainerRect(wrapper);

        // Press Home to go to minimum
        fireEvent.keyDown(resizer, { key: 'Home' });
        expect(pane1.style.width).toBe('100px');

        // Press End to go to maximum
        fireEvent.keyDown(resizer, { key: 'End' });
        expect(pane1.style.width).toBe('500px');
    });

    it('warns about deprecated minSize prop', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        render(
            <SplitPane split="vertical" defaultSize={200} minSize={100}>
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[SplitPane] The "minSize" prop is deprecated'),
        );

        consoleSpy.mockRestore();
    });

    it('warns about deprecated maxSize prop', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        render(
            <SplitPane split="vertical" defaultSize={200} maxSize={400}>
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[SplitPane] The "maxSize" prop is deprecated'),
        );

        consoleSpy.mockRestore();
    });

    it('uses minWidth instead of minSize for vertical split', () => {
        const { container } = render(
            <SplitPane split="vertical" defaultSize={200} minSize={100} minWidth={150}>
                <div>Pane 1</div>
                <div>Pane 2</div>
            </SplitPane>,
        );

        const resizer = container.querySelector('[role="separator"]') as HTMLElement;
        const wrapper = container.firstChild as HTMLElement;

        mockContainerRect(wrapper);

        fireEvent.mouseDown(resizer);
        // Try to resize below minWidth
        fireEvent.mouseMove(document, {
            clientX: 50,
            clientY: 0,
        });

        const pane1 = wrapper.children[0] as HTMLElement;
        // Should be clamped to minWidth (150), not minSize (100)
        expect(pane1.style.width).toBe('150px');

        fireEvent.mouseUp(document);
    });
});
