import { toCount } from '../data';

export interface SankeyNodeInput {
    name: string;
    /** CSS colour, already resolved. */
    color: string;
}

export interface SankeyLinkInput {
    /** Node names. */
    source: string;
    target: string;
    value: number;
}

export interface SankeyOptions {
    nodes: SankeyNodeInput[];
    links: SankeyLinkInput[];
    width: number;
    height: number;
    /** Node bar width, px. Default 10. */
    nodeWidth?: number;
    /** Vertical gap between nodes in a column, px. Default 12. */
    nodePadding?: number;
}

export interface SankeyNode extends SankeyNodeInput {
    index: number;
    /** Column, 0 at the sources. Nodes with no outgoing links sit in the last column. */
    depth: number;
    x: number;
    y: number;
    width: number;
    height: number;
    /** The larger of what flows in and what flows out. */
    value: number;
    valueIn: number;
    valueOut: number;
}

export interface SankeyLink {
    index: number;
    source: SankeyNode;
    target: SankeyNode;
    value: number;
    /** Centre line, drawn with `stroke-width` = `width`. */
    path: string;
    width: number;
}

export interface SankeyLayout {
    nodes: SankeyNode[];
    links: SankeyLink[];
    width: number;
    height: number;
    columns: number;
}

/**
 * Columns by longest path from a source, nodes stacked and centred per column, one
 * scale for every column so a band keeps its thickness end to end. Links leave and
 * enter each node ordered by the other end's position, so bands do not cross at
 * the nodes. Cycles are not drawn: the link that closes one is dropped.
 */
export function computeSankey({
    nodes: nodeInputs,
    links: linkInputs,
    width,
    height,
    nodeWidth = 10,
    nodePadding = 12,
}: SankeyOptions): SankeyLayout {
    const byName = new Map(nodeInputs.map((n, i) => [n.name, i]));
    const raw = linkInputs
        .map((l) => ({ s: byName.get(l.source), t: byName.get(l.target), value: toCount(l.value) }))
        // Unknown nodes, self-loops and empty links have nothing to draw.
        .filter(
            (l): l is { s: number; t: number; value: number } =>
                l.s !== undefined && l.t !== undefined && l.s !== l.t && l.value > 0,
        );

    // Drop the links that close a cycle: back edges of a depth-first walk in input order.
    const state = nodeInputs.map(() => 0); // 0 unseen, 1 on the walk, 2 done
    const back = new Set<number>();
    const visit = (i: number) => {
        state[i] = 1;
        raw.forEach((l, li) => {
            if (l.s !== i) return;
            if (state[l.t] === 1) back.add(li);
            else if (state[l.t] === 0) visit(l.t);
        });
        state[i] = 2;
    };
    nodeInputs.forEach((_, i) => state[i] === 0 && visit(i));
    const kept = raw.filter((_, li) => !back.has(li));

    // Longest path from a source; n relaxing passes settle any DAG.
    const depth = nodeInputs.map(() => 0);
    for (let pass = 0; pass < nodeInputs.length; pass++) {
        let changed = false;
        for (const l of kept) {
            if (depth[l.t]! < depth[l.s]! + 1) {
                depth[l.t] = depth[l.s]! + 1;
                changed = true;
            }
        }
        if (!changed) break;
    }
    const hasOut = new Set(kept.map((l) => l.s));
    const maxDepth = Math.max(0, ...depth);
    // Sinks align right, the way readers expect the flow to end.
    nodeInputs.forEach((_, i) => {
        if (!hasOut.has(i) && kept.some((l) => l.t === i)) depth[i] = maxDepth;
    });

    const valueIn = nodeInputs.map((_, i) => kept.filter((l) => l.t === i).reduce((s, l) => s + l.value, 0));
    const valueOut = nodeInputs.map((_, i) => kept.filter((l) => l.s === i).reduce((s, l) => s + l.value, 0));
    const value = nodeInputs.map((_, i) => Math.max(valueIn[i]!, valueOut[i]!));

    const columns = Array.from({ length: maxDepth + 1 }, (_, d) =>
        nodeInputs.map((_, i) => i).filter((i) => depth[i] === d),
    );
    // One px-per-unit for the whole chart: the tightest column decides it.
    const k = Math.min(
        ...columns
            .filter((c) => c.length > 0)
            .map((c) => {
                const total = c.reduce((s, i) => s + value[i]!, 0);
                return total > 0 ? Math.max(0, height - (c.length - 1) * nodePadding) / total : Infinity;
            }),
    );
    const scale = Number.isFinite(k) ? k : 0;
    const step = maxDepth > 0 ? (width - nodeWidth) / maxDepth : 0;

    const nodes: SankeyNode[] = nodeInputs.map((n, i) => ({
        ...n,
        index: i,
        depth: depth[i]!,
        x: maxDepth > 0 ? depth[i]! * step : (width - nodeWidth) / 2,
        y: 0,
        width: nodeWidth,
        height: value[i]! * scale,
        value: value[i]!,
        valueIn: valueIn[i]!,
        valueOut: valueOut[i]!,
    }));
    for (const col of columns) {
        const used = col.reduce((s, i) => s + nodes[i]!.height, 0) + Math.max(0, col.length - 1) * nodePadding;
        let y = (height - used) / 2;
        for (const i of col) {
            nodes[i]!.y = y;
            y += nodes[i]!.height + nodePadding;
        }
    }

    const r = (n: number) => Math.round(n * 100) / 100;
    const links = kept.map((l, index) => ({ ...l, index, w: l.value * scale, sy: 0, ty: 0 }));
    // Stack each node's bands in the order of the node at the other end.
    nodes.forEach((n) => {
        let out = n.y;
        for (const l of links.filter((l) => l.s === n.index).sort((a, b) => nodes[a.t]!.y - nodes[b.t]!.y)) {
            l.sy = out + l.w / 2;
            out += l.w;
        }
        let into = n.y;
        for (const l of links.filter((l) => l.t === n.index).sort((a, b) => nodes[a.s]!.y - nodes[b.s]!.y)) {
            l.ty = into + l.w / 2;
            into += l.w;
        }
    });

    return {
        nodes,
        links: links.map((l) => {
            const source = nodes[l.s]!;
            const target = nodes[l.t]!;
            const x0 = source.x + source.width;
            const x1 = target.x;
            const mid = (x0 + x1) / 2;
            return {
                index: l.index,
                source,
                target,
                value: l.value,
                width: l.w,
                path: `M${r(x0)},${r(l.sy)}C${r(mid)},${r(l.sy)} ${r(mid)},${r(l.ty)} ${r(x1)},${r(l.ty)}`,
            };
        }),
        width,
        height,
        columns: maxDepth + 1,
    };
}
