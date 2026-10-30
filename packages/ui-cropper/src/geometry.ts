/**
 * Pure geometry for the fixed-viewfinder model.
 *
 * The frame is an axis-aligned rect in stage pixels. The image is placed by a View:
 *   stage = (cx, cy) + scale · Flip · Rotate(rotation) · local
 * where `local` is an image pixel measured from the image centre. Flip is applied in stage
 * space (after rotation) so "flip horizontal" always mirrors left-right on screen whatever
 * the rotation. Every function here is side-effect free and unit tested.
 */

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Point {
    x: number;
    y: number;
}

export interface View {
    /** Image centre in stage px */
    cx: number;
    cy: number;
    /** Stage px per image px */
    scale: number;
    /** Degrees, clockwise on screen before flips; unbounded so CSS can animate the shortest way */
    rotation: number;
    flipX: boolean;
    flipY: boolean;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

export const center = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Largest rect of aspect `ratio` (w/h) centred in `area`; null fills the area. */
export function fitRect(area: Rect, ratio: number | null): Rect {
    let w = area.w;
    let h = area.h;
    if (ratio && ratio > 0) {
        if (w / h > ratio) w = h * ratio;
        else h = w / ratio;
    }
    return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h };
}

/** Half extents of a w×h rect's bounding box after rotating it by `deg`. */
export function rotatedHalfExtents(w: number, h: number, deg: number): Point {
    const c = Math.abs(Math.cos(rad(deg)));
    const s = Math.abs(Math.sin(rad(deg)));
    return { x: (w * c + h * s) / 2, y: (w * s + h * c) / 2 };
}

/** Smallest scale at which an iw×ih image rotated by `deg` fully covers a fw×fh frame. */
export function coverScale(iw: number, ih: number, fw: number, fh: number, deg: number): number {
    if (iw <= 0 || ih <= 0) return 1;
    const e = rotatedHalfExtents(fw, fh, deg);
    return Math.max((2 * e.x) / iw, (2 * e.y) / ih);
}

/** Raise the scale to cover the frame, then move the image as little as needed so no frame pixel is empty. */
export function clampView(view: View, frame: Rect, iw: number, ih: number): View {
    const scale = Math.max(view.scale, coverScale(iw, ih, frame.w, frame.h, view.rotation));
    const fc = center(frame);
    // frame centre relative to the image centre, taken into the image's own axes
    let dx = fc.x - view.cx;
    let dy = fc.y - view.cy;
    if (view.flipX) dx = -dx;
    if (view.flipY) dy = -dy;
    const t = rad(view.rotation);
    const c = Math.cos(t);
    const s = Math.sin(t);
    let lx = c * dx + s * dy;
    let ly = -s * dx + c * dy;
    const e = rotatedHalfExtents(frame.w, frame.h, view.rotation);
    const mx = Math.max(0, (iw * scale) / 2 - e.x);
    const my = Math.max(0, (ih * scale) / 2 - e.y);
    lx = Math.max(-mx, Math.min(mx, lx));
    ly = Math.max(-my, Math.min(my, ly));
    dx = c * lx - s * ly;
    dy = s * lx + c * ly;
    if (view.flipX) dx = -dx;
    if (view.flipY) dy = -dy;
    return { ...view, scale, cx: fc.x - dx, cy: fc.y - dy };
}

/** Does the image fully cover the frame at this view? */
export function covers(view: View, frame: Rect, iw: number, ih: number): boolean {
    const c = clampView(view, frame, iw, ih);
    return Math.abs(c.cx - view.cx) < 0.01 && Math.abs(c.cy - view.cy) < 0.01 && c.scale <= view.scale + 1e-9;
}

/** Stage point → image pixel (natural coordinates, origin top-left). */
export function toImage(p: Point, view: View, iw: number, ih: number): Point {
    let dx = p.x - view.cx;
    let dy = p.y - view.cy;
    if (view.flipX) dx = -dx;
    if (view.flipY) dy = -dy;
    const t = rad(view.rotation);
    const c = Math.cos(t);
    const s = Math.sin(t);
    return { x: (c * dx + s * dy) / view.scale + iw / 2, y: (-s * dx + c * dy) / view.scale + ih / 2 };
}

/** Change scale while keeping the image pixel under `anchor` fixed on screen. */
export function zoomAbout(view: View, scale: number, anchor: Point): View {
    const k = scale / view.scale;
    return { ...view, scale, cx: anchor.x + k * (view.cx - anchor.x), cy: anchor.y + k * (view.cy - anchor.y) };
}

/** Similarity transform of the view so the content under `from` ends up under `to`. */
export function refit(view: View, from: Rect, to: Rect): View {
    if (from.w <= 0 || from.h <= 0) return view;
    const k = to.w / from.w;
    const a = center(from);
    const b = center(to);
    return { ...view, scale: view.scale * k, cx: b.x + k * (view.cx - a.x), cy: b.y + k * (view.cy - a.y) };
}

/** Mirror the image about the frame's vertical (axis 'x') or horizontal ('y') centre line. */
export function flip(view: View, frame: Rect, axis: 'x' | 'y'): View {
    const fc = center(frame);
    return axis === 'x'
        ? { ...view, flipX: !view.flipX, cx: 2 * fc.x - view.cx }
        : { ...view, flipY: !view.flipY, cy: 2 * fc.y - view.cy };
}

/** Rotate the image about the frame centre by `deg` degrees clockwise as seen on screen. */
export function rotateAbout(view: View, frame: Rect, deg: number): View {
    // Flips are applied after rotation, so under a single flip a +θ local turn reads anticlockwise.
    const sign = view.flipX !== view.flipY ? -1 : 1;
    const fc = center(frame);
    const t = rad(deg);
    const c = Math.cos(t);
    const s = Math.sin(t);
    const dx = view.cx - fc.x;
    const dy = view.cy - fc.y;
    return { ...view, rotation: view.rotation + sign * deg, cx: fc.x + c * dx - s * dy, cy: fc.y + s * dx + c * dy };
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Resize `start` by dragging `handle` by (dx, dy), kept inside `bounds` and at least `min` px a side. */
export function resizeRect(start: Rect, handle: Handle, dx: number, dy: number, bounds: Rect, min: number): Rect {
    let x1 = start.x;
    let y1 = start.y;
    let x2 = start.x + start.w;
    let y2 = start.y + start.h;
    if (handle.includes('w')) x1 = Math.max(bounds.x, Math.min(x2 - min, x1 + dx));
    if (handle.includes('e')) x2 = Math.min(bounds.x + bounds.w, Math.max(x1 + min, x2 + dx));
    if (handle.includes('n')) y1 = Math.max(bounds.y, Math.min(y2 - min, y1 + dy));
    if (handle.includes('s')) y2 = Math.min(bounds.y + bounds.h, Math.max(y1 + min, y2 + dy));
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
