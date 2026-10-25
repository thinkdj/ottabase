import type { CartesianLayout } from '../../layout/cartesian';

/**
 * What every cartesian sub-component needs: the computed layout and how to place it.
 * A horizontal chart is the same layout rotated a quarter turn: marks are drawn in
 * computed space inside a rotated `<g>`, and anything with text goes through `pt()`.
 */
export interface Frame<L extends AxesLayout = CartesianLayout> {
    layout: L;
    /** Actual pixel size of the SVG. */
    width: number;
    height: number;
    transposed: boolean;
}

/** What `Axes` reads: any chart with a plot box and ticks (scatter, waterfall) can use it. */
export type AxesLayout = Pick<CartesianLayout, 'plot' | 'xTicks' | 'yTicks' | 'y2Ticks'>;

/** Actual coordinates of a point in computed space. */
export function pt(f: Frame<AxesLayout>, x: number, y: number): [number, number] {
    return f.transposed ? [f.width - y, x] : [x, y];
}

/** The transform that maps computed space onto the SVG for mark groups. */
export function markTransform(f: Frame): string | undefined {
    return f.transposed ? `translate(${f.width} 0) rotate(90)` : undefined;
}

/** Left edge of the category axis labels on a horizontal chart. */
export function categoryAxisX(f: Frame<AxesLayout>): number {
    return f.width - (f.layout.plot.y + f.layout.plot.height) - 8;
}
