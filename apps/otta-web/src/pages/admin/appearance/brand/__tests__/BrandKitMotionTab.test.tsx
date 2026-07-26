import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BrandKitMotionTab } from '../BrandKitMotionTab';

const TOKENS = JSON.stringify({
    motion: {
        durationFast: '120ms',
        durationNormal: '240ms',
        durationSlow: '600ms',
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        easingEnter: 'linear',
    },
});

const renderTab = (tokensJson = TOKENS) =>
    render(<BrandKitMotionTab tokensJson={tokensJson} onTokensChange={vi.fn()} />);

/** Elements whose inline `animation` shorthand mentions the given keyframes name */
const animated = (container: HTMLElement, keyframes: string) =>
    [...container.querySelectorAll<HTMLElement>('[style*="animation"]')].filter((el) =>
        el.style.animation.includes(keyframes),
    );

describe('BrandKitMotionTab preview', () => {
    it('races the three durations on their own tracks, each labelled with its value', () => {
        const { container } = renderTab();
        expect(screen.getByText('Fast')).toBeInTheDocument();
        expect(screen.getByText(/120ms · hovers/)).toBeInTheDocument();
        expect(screen.getByText(/240ms · dropdowns/)).toBeInTheDocument();
        expect(screen.getByText(/600ms · drawers/)).toBeInTheDocument();

        const runners = animated(container, 'motion-preview-travel');
        // 3 duration tracks + an eased/linear pair per easing card
        expect(runners.length).toBe(9);
        expect(runners[0].style.animation).toContain('120ms');
    });

    it('plots each easing as a bezier curve and compares it against linear', () => {
        const { container } = renderTab();
        expect(screen.getByText('Default')).toBeInTheDocument();
        expect(screen.getByText('Enter')).toBeInTheDocument();
        expect(screen.getByText('Exit')).toBeInTheDocument();
        // Bouncy overshoots, so its second control point sits above the unit square (negative y)
        const curves = [...container.querySelectorAll('path')].map((p) => p.getAttribute('d'));
        expect(curves.some((d) => d?.includes('C 34 -56'))).toBe(true);
        // A `linear` easing plots as a straight line rather than a curve
        expect(curves).toContain('M0 100 L100 0');
    });

    it('zeroes every duration when animations are disabled', () => {
        const { container } = renderTab(JSON.stringify({ motion: { disableAnimations: true } }));
        expect(screen.getByText(/Animations are disabled/)).toBeInTheDocument();
        for (const el of animated(container, 'motion-preview-')) {
            expect(el.style.animation).toContain('0ms');
        }
    });

    it('dims and locks the preview plus the token controls when animations are disabled', () => {
        const { container } = renderTab(JSON.stringify({ motion: { disableAnimations: true } }));
        const fieldset = container.querySelector('fieldset')!;
        expect(fieldset.disabled).toBe(true);
        expect(fieldset.className).toContain('opacity-50');
        // The disable checkbox itself stays outside the locked region
        expect(fieldset.contains(screen.getByLabelText('Disable animations'))).toBe(false);
    });

    it('restarts the animations when Replay is pressed', () => {
        const { container } = renderTab();
        const before = animated(container, 'motion-preview-travel')[0];
        fireEvent.click(screen.getByRole('button', { name: /replay/i }));
        // Remounting via key gives a fresh node, which is what restarts the CSS animation
        expect(animated(container, 'motion-preview-travel')[0]).not.toBe(before);
    });
});
