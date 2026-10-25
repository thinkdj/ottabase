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
    // Links between the same two nodes are one band: 50,000 event rows become a few dozen flows.
    const merged = new Map<string, { s: number; t: number; value: number }>();
    for (const l of linkInputs) {
        const s = byName.get(l.source);
        const t = byName.get(l.target);
        const value = toCount(l.value);
        // Unknown nodes, self-loops and empty links have nothing to draw.
        if (s === undefined || t === undefined || s === t || value <= 0) continue;
        const key = `${s}>${t}`;
        const m = merged.get(key);
        if (m) m.value += value;
        else merged.set(key, { s, t, value });
    }
    const raw = [...merged.values()];
    const outOf = nodeInputs.map(() => [] as number[]);
    raw.forEach((l, li) => (outOf[l.s] as number[]).push(li));

    // Drop the links that close a cycle: back edges of a depth-first walk in input order.
    // Iterative, so a long chain of nodes cannot overflow the call stack. The finish order
    // of the same walk is a topological order of what is left.
    const state = nodeInputs.map(() => 0); // 0 unseen, 1 on the walk, 2 done
    const back = new Set<number>();
    const finished: number[] = [];
    for (let root = 0; root < nodeInputs.length; root++) {
        if (state[root] !== 0) continue;
        const stack: [number, number][] = [[root, 0]];
        state[root] = 1;
        while (stack.length) {
            const top = stack[stack.length - 1] as [number, number];
            const [node, next] = top;
            const out = outOf[node] as number[];
            if (next >= out.length) {
                state[node] = 2;
                finished.push(node);
                stack.pop();
                continue;
            }
            top[1] = next + 1;
            const li = out[next] as number;
            const t = (raw[li] as { t: number }).t;
            if (state[t] === 1) back.add(li);
            else if (state[t] === 0) {
                state[t] = 1;
                stack.push([t, 0]);
            }
        }
    }
    const kept = raw.filter((_, li) => !back.has(li));
    const keptOut = nodeInputs.map(() => [] as typeof kept);
    const keptIn = nodeInputs.map(() => [] as typeof kept);
    for (const l of kept) {
        (keptOut[l.s] as typeof kept).push(l);
        (keptIn[l.t] as typeof kept).push(l);
    }

    // Longest path from a source, relaxed once in topological order.
    const depth = nodeInputs.map(() => 0);
    for (let k = finished.length - 1; k >= 0; k--) {
        const n = finished[k] as number;
        for (const l of keptOut[n] as typeof kept) depth[l.t] = Math.max(depth[l.t]!, depth[n]! + 1);
    }
    const maxDepth = depth.reduce((m, d) => Math.max(m, d), 0);
    // Sinks align right, the way readers expect the flow to end.
    nodeInputs.forEach((_, i) => {
        if ((keptOut[i] as typeof kept).length === 0 && (keptIn[i] as typeof kept).length > 0) depth[i] = maxDepth;
    });

    const sum = (ls: typeof kept) => ls.reduce((s, l) => s + l.value, 0);
    const valueIn = keptIn.map(sum);
    const valueOut = keptOut.map(sum);
    const value = nodeInputs.map((_, i) => Math.max(valueIn[i]!, valueOut[i]!));

    const columns = Array.from({ length: maxDepth + 1 }, () => [] as number[]);
    depth.forEach((d, i) => (columns[d] as number[]).push(i));
    // One px-per-unit for the whole chart: the tightest column decides it.
    const k = columns.reduce((min, c) => {
        const total = c.reduce((s, i) => s + value[i]!, 0);
        return total > 0 ? Math.min(min, Math.max(0, height - (c.length - 1) * nodePadding) / total) : min;
    }, Infinity);
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
    const linksOut = nodeInputs.map(() => [] as typeof links);
    const linksIn = nodeInputs.map(() => [] as typeof links);
    for (const l of links) {
        (linksOut[l.s] as typeof links).push(l);
        (linksIn[l.t] as typeof links).push(l);
    }
    // Stack each node's bands in the order of the node at the other end.
    nodes.forEach((n) => {
        let out = n.y;
        for (const l of (linksOut[n.index] as typeof links).sort((a, b) => nodes[a.t]!.y - nodes[b.t]!.y)) {
            l.sy = out + l.w / 2;
            out += l.w;
        }
        let into = n.y;
        for (const l of (linksIn[n.index] as typeof links).sort((a, b) => nodes[a.s]!.y - nodes[b.s]!.y)) {
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
