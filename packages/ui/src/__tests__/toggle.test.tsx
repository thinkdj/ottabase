// A toggle on its own reads as a control; inside a default group it is a segment on the group's track.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Toggle } from '../../components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';

describe('Toggle variants', () => {
    it('gives a standalone toggle a hover fill and the brand fill when pressed, not the segment lift', () => {
        render(<Toggle defaultPressed>Bold</Toggle>);
        const toggle = screen.getByRole('button', { name: 'Bold' });
        expect(toggle).toHaveAttribute('data-variant', 'default');
        expect(toggle.className).toContain('data-[state=on]:bg-accent');
        expect(toggle.className).not.toContain('data-[state=on]:bg-card');
        // As tall as a whole default segmented control (28px segment + track padding and border)
        expect(toggle.className).toContain('h-9');
        expect(toggle.className).not.toContain('h-7');
    });

    it('makes the items of a default group segments, and keeps an outline group outlined', () => {
        const { rerender } = render(
            <ToggleGroup type="single" defaultValue="a">
                <ToggleGroupItem value="a">A</ToggleGroupItem>
            </ToggleGroup>,
        );
        expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('data-variant', 'segment');
        expect(screen.getByRole('radio', { name: 'A' }).className).toContain('data-[state=on]:bg-card');
        expect(screen.getByRole('radio', { name: 'A' }).className).toContain('h-7');

        rerender(
            <ToggleGroup type="single" variant="outline" defaultValue="a">
                <ToggleGroupItem value="a">A</ToggleGroupItem>
            </ToggleGroup>,
        );
        expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('data-variant', 'outline');
    });
});
