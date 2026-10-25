import { toCount } from '../data';

export interface TreemapItem {
    name: string;
    value: number;
    /** Parent tile; items with the same group are laid out together. Omit for a flat treemap. */
    group?: string;
}

export interface TreemapOptions {
    items: TreemapItem[];
    width: number;
    height: number;
    /** Colour per group, or the one colour of a flat treemap, already resolved. */
    colorOf: (group: string | null, index: number) => string;
    /** Space between tiles, px. Default 2 (the bar gap). */
    gap?: number;
    /** Height of a group's title strip, px; dropped when the group is too short for it. Default 20. */
    headerHeight?: number;
    /**
     * Tiles drawn. Past this, each group's smallest items fold into one "Other" tile that
     * keeps their sum, so 50,000 items draw as a readable map. Default 150.
     */
    maxTiles?: number;
    /** Groups drawn; the smallest fold into one "Other" group. Default 8, the slot count. */
    maxGroups?: number;
    /** Name of a folded tile or group. Default `Other`. */
    otherLabel?: string;
}

export interface TreemapTile {
    index: number;
    name: string;
    group: string | null;
    value: number;
    /** Share of the whole map, 0-1. */
    share: number;
    /** Share of its group (1 in a flat treemap). */
    groupShare: number;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
    /** Items folded into this tile; 0 for a real item. */
    folded: number;
}

export interface TreemapGroup {
    name: string;
    value: number;
    share: number;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
    /** Whether the title strip fits; tiles start below it when it does. */
    header: boolean;
}

export interface TreemapLayout {
    tiles: TreemapTile[];
    /** Empty for a flat treemap. */
    groups: TreemapGroup[];
    total: number;
    width: number;
    height: number;
    /** Items folded into "Other" tiles across the map. */
    folded: number;
}

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * Squarified treemap (Bruls, Huizing and van Wijk): rows of tiles along the short side,
 * each row grown while that keeps its tiles closer to square. `values` sorted largest
 * first; returns one rectangle per value, in order.
 */
export function squarify(values: number[], rect: Rect): Rect[] {
    const total = values.reduce((s, v) => s + v, 0);
    let { x, y, w, h } = rect;
    if (total <= 0 || w <= 0 || h <= 0) return values.map(() => ({ x, y, w: 0, h: 0 }));
    const scale = (w * h) / total;
    const areas = values.map((v) => v * scale);
    const out: Rect[] = [];
    let i = 0;
    while (i < areas.length) {
        const side = Math.min(w, h);
        let j = i;
        let sum = 0;
        let lo = Infinity;
        let hi = 0;
        let best = Infinity;
        // Worst aspect ratio in the row: max(side²·max / sum², sum² / (side²·min)).
        while (j < areas.length) {
            const a = areas[j] as number;
            const s = sum + a;
            const nlo = Math.min(lo, a);
            const nhi = Math.max(hi, a);
            const worst = Math.max((side * side * nhi) / (s * s), (s * s) / (side * side * nlo));
            if (worst > best) break;
            best = worst;
            sum = s;
            lo = nlo;
            hi = nhi;
            j++;
        }
        const thick = side > 0 ? sum / side : 0;
        let at = 0;
        for (let k = i; k < j; k++) {
            const len = thick > 0 ? (areas[k] as number) / thick : 0;
            out.push(w >= h ? { x, y: y + at, w: thick, h: len } : { x: x + at, y, w: len, h: thick });
            at += len;
        }
        if (w >= h) {
            x += thick;
            w -= thick;
        } else {
            y += thick;
            h -= thick;
        }
        i = j;
    }
    return out;
}

/**
 * A treemap: area by value, optionally in groups (storage by tenant, then by bucket).
 * Zero and negative values are left out. Tiles are inset by half the gap on every
 * side, so neighbours sit `gap` apart.
 */
export function computeTreemap({
    items,
    width,
    height,
    colorOf,
    gap = 2,
    headerHeight = 20,
    maxTiles = 150,
    maxGroups = 8,
    otherLabel = 'Other',
}: TreemapOptions): TreemapLayout {
    const positive = items
        .map((item) => ({ ...item, value: toCount(item.value) }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value);
    const total = positive.reduce((s, i) => s + i.value, 0);
    const grouped = positive.some((i) => i.group !== undefined);

    // Groups past `maxGroups` (by total) become one "Other" group.
    const groupTotals = new Map<string, number>();
    for (const item of positive) {
        const g = item.group ?? '';
        groupTotals.set(g, (groupTotals.get(g) ?? 0) + item.value);
    }
    const topGroups = new Set(
        [...groupTotals.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxGroups)
            .map(([g]) => g),
    );
    const keyOf = (group: string | undefined) =>
        grouped ? (topGroups.has(group ?? '') ? (group ?? '') : otherLabel) : '';

    // The largest items overall keep a tile; the rest of each group folds into its Other.
    const kept = positive.slice(0, Math.max(1, maxTiles));
    const rest = positive.slice(kept.length);
    const byGroup = new Map<string, { name: string; value: number; folded: number }[]>();
    for (const item of kept) {
        const k = keyOf(item.group);
        const list = byGroup.get(k) ?? [];
        list.push({ name: item.name, value: item.value, folded: 0 });
        byGroup.set(k, list);
    }
    const otherOf = new Map<string, { name: string; value: number; folded: number }>();
    for (const item of rest) {
        const k = keyOf(item.group);
        const o = otherOf.get(k) ?? { name: item.name, value: 0, folded: 0 };
        o.value += item.value;
        o.folded += 1;
        otherOf.set(k, o);
    }
    for (const [k, o] of otherOf) {
        const list = byGroup.get(k) ?? [];
        // One folded item keeps its own name; it is not an "Other" of anything.
        list.push(o.folded === 1 ? { ...o, folded: 0 } : { ...o, name: otherLabel });
        list.sort((a, b) => b.value - a.value);
        byGroup.set(k, list);
    }

    const half = gap / 2;
    const tiles: TreemapTile[] = [];
    const groups: TreemapGroup[] = [];
    const entries = [...byGroup.entries()]
        .map(([name, list]) => ({ name, list, value: list.reduce((s, t) => s + t.value, 0) }))
        .sort((a, b) => b.value - a.value);
    const groupRects = squarify(
        entries.map((e) => e.value),
        { x: 0, y: 0, w: width, h: height },
    );
    entries.forEach((entry, gi) => {
        const g = groupRects[gi] as Rect;
        const color = colorOf(grouped ? entry.name : null, gi);
        let inner: Rect = g;
        if (grouped) {
            const header = g.h >= headerHeight * 2.5 && g.w >= 48;
            groups.push({
                name: entry.name,
                value: entry.value,
                share: total > 0 ? entry.value / total : 0,
                color,
                x: g.x + half,
                y: g.y + half,
                width: Math.max(0, g.w - gap),
                height: Math.max(0, g.h - gap),
                header,
            });
            // Inside a group, tiles sit a further gap in, so groups read as blocks.
            const top = header ? headerHeight : half;
            inner = { x: g.x + half, y: g.y + top, w: Math.max(0, g.w - gap), h: Math.max(0, g.h - top - half) };
        }
        const rects = squarify(
            entry.list.map((t) => t.value),
            inner,
        );
        entry.list.forEach((t, ti) => {
            const r = rects[ti] as Rect;
            tiles.push({
                index: tiles.length,
                name: t.name,
                group: grouped ? entry.name : null,
                value: t.value,
                share: total > 0 ? t.value / total : 0,
                groupShare: entry.value > 0 ? t.value / entry.value : 0,
                color,
                x: r.x + half,
                y: r.y + half,
                width: Math.max(0, r.w - gap),
                height: Math.max(0, r.h - gap),
                folded: t.folded,
            });
        });
    });
    return { tiles, groups, total, width, height, folded: rest.length };
}
