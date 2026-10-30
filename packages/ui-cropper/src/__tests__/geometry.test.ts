import { describe, expect, it } from 'vitest';
import type { Rect, View } from '../geometry';
import {
    clampView,
    coverScale,
    covers,
    fitRect,
    flip,
    refit,
    resizeRect,
    rotateAbout,
    toImage,
    zoomAbout,
} from '../geometry';

const frame: Rect = { x: 20, y: 20, w: 300, h: 200 };
const iw = 1200;
const ih = 800;
const home = (): View => ({
    cx: 170,
    cy: 120,
    scale: coverScale(iw, ih, frame.w, frame.h, 0),
    rotation: 0,
    flipX: false,
    flipY: false,
});

const corners = (r: Rect) => [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x, y: r.y + r.h },
    { x: r.x + r.w, y: r.y + r.h },
];

/** Every frame corner lands inside the image: the frame is covered. */
const framedByImage = (view: View, f: Rect) =>
    corners(f).every((c) => {
        const p = toImage(c, view, iw, ih);
        return p.x >= -1e-6 && p.x <= iw + 1e-6 && p.y >= -1e-6 && p.y <= ih + 1e-6;
    });

describe('fitRect', () => {
    it('inscribes an aspect centred in the area', () => {
        const r = fitRect({ x: 0, y: 0, w: 400, h: 300 }, 1);
        expect(r).toEqual({ x: 50, y: 0, w: 300, h: 300 });
        const wide = fitRect({ x: 10, y: 10, w: 400, h: 300 }, 16 / 9);
        expect(wide.w).toBe(400);
        expect(wide.h).toBeCloseTo(225);
        expect(wide.y).toBeCloseTo(10 + 37.5);
    });
    it('fills the area when the ratio is free', () => {
        expect(fitRect({ x: 1, y: 2, w: 30, h: 40 }, null)).toEqual({ x: 1, y: 2, w: 30, h: 40 });
    });
});

describe('coverScale', () => {
    it('is the larger of the two axis ratios', () => {
        expect(coverScale(1200, 800, 300, 200, 0)).toBeCloseTo(0.25);
        expect(coverScale(800, 1200, 300, 200, 0)).toBeCloseTo(300 / 800);
    });
    it('grows with rotation because the rotated frame needs a bigger box', () => {
        expect(coverScale(1200, 800, 300, 200, 45)).toBeGreaterThan(coverScale(1200, 800, 300, 200, 0));
        expect(coverScale(1200, 800, 300, 200, 90)).toBeCloseTo(300 / 800);
    });
});

describe('clampView', () => {
    it('leaves a covering view alone', () => {
        const v = home();
        expect(clampView(v, frame, iw, ih)).toEqual(v);
    });
    it('pulls a panned image back until the frame is covered', () => {
        const v = { ...home(), cx: 400, cy: 300 };
        const c = clampView(v, frame, iw, ih);
        expect(framedByImage(c, frame)).toBe(true);
        expect(covers(v, frame, iw, ih)).toBe(false);
        expect(covers(c, frame, iw, ih)).toBe(true);
    });
    it('raises a too-small scale to cover', () => {
        const c = clampView({ ...home(), scale: 0.01 }, frame, iw, ih);
        expect(c.scale).toBeCloseTo(0.25);
    });
    it('covers under rotation and flips', () => {
        for (const rotation of [90, 180, 270, 17, -33]) {
            for (const flipX of [false, true]) {
                const v = { ...home(), rotation, flipX, cx: 900, cy: -50 };
                const c = clampView(v, frame, iw, ih);
                expect(framedByImage(c, frame)).toBe(true);
            }
        }
    });
});

describe('toImage', () => {
    it('maps the frame centre to the image centre at home', () => {
        expect(toImage({ x: 170, y: 120 }, home(), iw, ih)).toEqual({ x: 600, y: 400 });
    });
    it('respects a horizontal flip', () => {
        const p = toImage({ x: 20, y: 120 }, { ...home(), flipX: true }, iw, ih);
        expect(p.x).toBeCloseTo(600 + 150 / 0.25);
    });
});

describe('zoomAbout', () => {
    it('keeps the image pixel under the anchor fixed', () => {
        const v = home();
        const anchor = { x: 50, y: 60 };
        const before = toImage(anchor, v, iw, ih);
        const after = toImage(anchor, zoomAbout(v, v.scale * 2, anchor), iw, ih);
        expect(after.x).toBeCloseTo(before.x);
        expect(after.y).toBeCloseTo(before.y);
    });
});

describe('refit', () => {
    it('keeps the same content under a frame that moved and grew', () => {
        const v = home();
        const to: Rect = { x: 100, y: 50, w: 600, h: 400 };
        const r = refit(v, frame, to);
        for (const [a, b] of corners(frame).map((c, i) => [c, corners(to)[i]!] as const)) {
            const pa = toImage(a, v, iw, ih);
            const pb = toImage(b, r, iw, ih);
            expect(pb.x).toBeCloseTo(pa.x);
            expect(pb.y).toBeCloseTo(pa.y);
        }
    });
});

describe('flip', () => {
    it('mirrors what is under the frame about its centre line', () => {
        const v = { ...home(), cx: 150 };
        const f = flip(v, frame, 'x');
        const left = toImage({ x: frame.x, y: 120 }, v, iw, ih);
        const right = toImage({ x: frame.x + frame.w, y: 120 }, f, iw, ih);
        expect(right.x).toBeCloseTo(left.x);
        expect(f.flipX).toBe(true);
    });
});

describe('rotateAbout', () => {
    it('turns the content clockwise on screen, flipped or not', () => {
        for (const flipX of [false, true]) {
            const v = { ...home(), flipX };
            const r = rotateAbout(v, frame, 90);
            // The pixel that was at the top centre of the frame is now at the right centre.
            const top = toImage({ x: 170, y: frame.y }, v, iw, ih);
            const right = toImage({ x: frame.x + frame.w, y: 120 }, r, iw, ih);
            // 100px above centre becomes 150px right of centre: directions match, distances differ.
            const dirBefore = { x: top.x - 600, y: top.y - 400 };
            const dirAfter = { x: right.x - 600, y: right.y - 400 };
            expect(Math.hypot(dirBefore.x, dirBefore.y)).toBeCloseTo(100 / v.scale);
            expect(Math.hypot(dirAfter.x, dirAfter.y)).toBeCloseTo(150 / v.scale);
            expect(dirAfter.x / Math.hypot(dirAfter.x, dirAfter.y)).toBeCloseTo(
                dirBefore.x / Math.hypot(dirBefore.x, dirBefore.y),
            );
            expect(dirAfter.y / Math.hypot(dirAfter.x, dirAfter.y)).toBeCloseTo(
                dirBefore.y / Math.hypot(dirBefore.x, dirBefore.y),
            );
        }
    });
});

describe('resizeRect', () => {
    const bounds: Rect = { x: 0, y: 0, w: 400, h: 300 };
    it('drags one edge and respects bounds and the minimum', () => {
        const start: Rect = { x: 100, y: 100, w: 100, h: 100 };
        expect(resizeRect(start, 'e', 50, 0, bounds, 20)).toEqual({ x: 100, y: 100, w: 150, h: 100 });
        expect(resizeRect(start, 'w', -500, 0, bounds, 20)).toEqual({ x: 0, y: 100, w: 200, h: 100 });
        expect(resizeRect(start, 'n', 0, 500, bounds, 20).h).toBe(20);
        expect(resizeRect(start, 'se', 20, -30, bounds, 20)).toEqual({ x: 100, y: 100, w: 120, h: 70 });
    });
});
