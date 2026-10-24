// Rating: one slider when interactive (WAI-ARIA rating slider), an image with its value when read-only.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Rating } from '../../components/ui/rating';

const stars = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-slot="rating-item"]')];

/** Gives each star a 20px box so pointer positions mean something in jsdom. */
function layOut(root: HTMLElement) {
    stars(root).forEach((star, index) => {
        const left = index * 20;
        star.getBoundingClientRect = () =>
            ({ left, right: left + 20, width: 20, top: 0, bottom: 20, height: 20, x: left, y: 0 }) as DOMRect;
    });
}

describe('<Rating>', () => {
    it('is a slider with its value range and text', () => {
        render(<Rating aria-label="Your rating" defaultValue={3} />);
        const slider = screen.getByRole('slider', { name: 'Your rating' });
        expect(slider).toHaveAttribute('aria-valuemin', '0');
        expect(slider).toHaveAttribute('aria-valuemax', '5');
        expect(slider).toHaveAttribute('aria-valuenow', '3');
        expect(slider).toHaveAttribute('aria-valuetext', '3 of 5 stars');
        expect(slider.tabIndex).toBe(0);
    });

    it('steps with the keyboard and stays in range', () => {
        const onValueChange = vi.fn();
        render(<Rating aria-label="r" defaultValue={4} onValueChange={onValueChange} />);
        const slider = screen.getByRole('slider');

        fireEvent.keyDown(slider, { key: 'ArrowRight' });
        fireEvent.keyDown(slider, { key: 'ArrowRight' }); // already at max
        expect(slider).toHaveAttribute('aria-valuenow', '5');
        fireEvent.keyDown(slider, { key: 'ArrowDown' });
        expect(slider).toHaveAttribute('aria-valuenow', '4');
        fireEvent.keyDown(slider, { key: 'Home' });
        expect(slider).toHaveAttribute('aria-valuenow', '0');
        fireEvent.keyDown(slider, { key: 'End' });
        expect(slider).toHaveAttribute('aria-valuenow', '5');
        fireEvent.keyDown(slider, { key: '2' });
        expect(slider).toHaveAttribute('aria-valuenow', '2');
        fireEvent.keyDown(slider, { key: '9' }); // more stars than there are: ignored
        expect(slider).toHaveAttribute('aria-valuenow', '2');
        expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([5, 4, 0, 5, 2]);
    });

    it('steps by halves when step is 0.5', () => {
        render(<Rating aria-label="r" step={0.5} defaultValue={3} />);
        const slider = screen.getByRole('slider');
        fireEvent.keyDown(slider, { key: 'ArrowLeft' });
        expect(slider).toHaveAttribute('aria-valuenow', '2.5');
        expect(slider).toHaveAttribute('aria-valuetext', '2.5 of 5 stars');
        fireEvent.keyDown(slider, { key: 'PageUp' });
        expect(slider).toHaveAttribute('aria-valuenow', '3.5');
    });

    it('commits a click, clears on a second click of the same star, and previews on hover', () => {
        render(<Rating aria-label="r" />);
        const slider = screen.getByRole('slider');
        layOut(slider);

        fireEvent.click(stars(slider)[2], { clientX: 50 });
        expect(slider).toHaveAttribute('aria-valuenow', '3');
        fireEvent.click(stars(slider)[2], { clientX: 50 });
        expect(slider).toHaveAttribute('aria-valuenow', '0');

        fireEvent.pointerMove(stars(slider)[3], { clientX: 70 });
        expect(stars(slider).map((star) => star.dataset.state)).toEqual(['full', 'full', 'full', 'full', 'empty']);
        expect(slider).toHaveAttribute('aria-valuenow', '0'); // a preview is not a value
        fireEvent.pointerLeave(slider);
        expect(stars(slider).every((star) => star.dataset.state === 'empty')).toBe(true);
    });

    it('picks the half under the pointer when step is 0.5', () => {
        render(<Rating aria-label="r" step={0.5} />);
        const slider = screen.getByRole('slider');
        layOut(slider);
        fireEvent.click(stars(slider)[3], { clientX: 64 }); // left half of the fourth star
        expect(slider).toHaveAttribute('aria-valuenow', '3.5');
        fireEvent.click(stars(slider)[3], { clientX: 76 }); // right half
        expect(slider).toHaveAttribute('aria-valuenow', '4');
    });

    it('read-only, is an image that names the value and shows fractions', () => {
        render(<Rating readOnly value={4.3} aria-label="Average" />);
        const image = screen.getByRole('img', { name: 'Average: 4.3 of 5 stars' });
        expect(image).not.toHaveAttribute('tabindex');
        expect(stars(image).map((star) => star.dataset.state)).toEqual(['full', 'full', 'full', 'full', 'partial']);
        const partialFill = stars(image)[4].querySelector<HTMLElement>('span');
        expect(parseFloat(partialFill!.style.width)).toBeCloseTo(30);
    });

    it('ignores input when disabled and submits with a form under its name', () => {
        const { container } = render(<Rating aria-label="r" defaultValue={2} disabled name="score" />);
        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-disabled', 'true');
        expect(slider.tabIndex).toBe(-1);
        fireEvent.keyDown(slider, { key: 'ArrowRight' });
        fireEvent.click(stars(slider)[4]);
        expect(slider).toHaveAttribute('aria-valuenow', '2');
        expect(container.querySelector('input[name="score"]')).toHaveValue('2');
    });

    it('shows a half value as a half-filled mark, read-only or interactive', () => {
        const { unmount } = render(<Rating readOnly value={2.5} aria-label="Score" />);
        const image = screen.getByRole('img', { name: 'Score: 2.5 of 5 stars' });
        expect(stars(image).map((star) => star.dataset.state)).toEqual(['full', 'full', 'partial', 'empty', 'empty']);
        expect(stars(image)[2].querySelector<HTMLElement>('[data-slot="rating-fill"]')!.style.width).toBe('50%');
        unmount();

        render(<Rating aria-label="Score" step={0.5} defaultValue={2.5} />);
        expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '2.5');
        expect(stars(screen.getByRole('slider'))[2].dataset.state).toBe('partial');
    });

    it('takes any SVG as the mark: a component, an element, and a separate empty mark', () => {
        const Drop = ({ className }: { className?: string }) => (
            <svg data-testid="drop" className={className} viewBox="0 0 24 24">
                <path d="M12 2 C 7 9 5 12 5 15 a7 7 0 0 0 14 0 c0-3-2-6-7-13z" fill="currentColor" />
            </svg>
        );
        const { unmount } = render(<Rating aria-label="Spice" icon={Drop} max={3} step={0.5} defaultValue={1.5} />);
        const drops = screen.getAllByTestId('drop');
        // one empty mark per item, plus a filled copy for each item with any fill
        expect(drops).toHaveLength(3 + 2);
        expect(drops[0]).toHaveClass('size-5', 'fill-muted');
        expect(stars(screen.getByRole('slider'))[1].dataset.state).toBe('partial');
        unmount();

        render(
            <Rating
                aria-label="Spice"
                max={3}
                defaultValue={1}
                icon={<svg data-testid="solid" className="custom" viewBox="0 0 24 24" />}
                emptyIcon={<svg data-testid="outline" viewBox="0 0 24 24" />}
            />,
        );
        expect(screen.getAllByTestId('outline')).toHaveLength(3);
        expect(screen.getAllByTestId('solid')).toHaveLength(1);
        // the element keeps its own class next to the rating's size and fill
        expect(screen.getByTestId('solid')).toHaveClass('custom', 'size-5');
    });

    it('says what a custom label function returns', () => {
        render(<Rating aria-label="r" defaultValue={1} max={3} getValueText={(v, max) => `${v}/${max} hearts`} />);
        expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '1/3 hearts');
    });
});
