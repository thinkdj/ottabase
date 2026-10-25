import type { CartesianLayout } from '../../layout/cartesian';

/**
 * What every cartesian sub-component needs: the computed layout and how to place it.
 * A horizontal chart is the same layout rotated a quarter turn: marks are drawn in
 * computed space inside a rotated `<g>`, and anything with text goes through `pt()`.
 */
export interface Frame {
    layout: CartesianLayout;
    /** Actual pixel size of the SVG. */
    width: number;
    height: number;
    transposed: boolean;
}

/** Actual coordinates of a point in computed space. */
export function pt(f: Frame, x: number, y: number): [number, number] {
    return f.transposed ? [f.width - y, x] : [x, y];
}

/** The transform that maps computed space onto the SVG for mark groups. */
export function markTransform(f: Frame): string | undefined {
    return f.transposed ? `translate(${f.width} 0) rotate(90)` : undefined;
}

/** Left edge of the category axis labels on a horizontal chart. */
export function categoryAxisX(f: Frame): number {
    return f.width - (f.layout.plot.y + f.layout.plot.height) - 8;
}
