/**
 * Large data. A chart is a few hundred pixels wide; 50,000 rows put a hundred rows in
 * every pixel column, and drawing all of them costs time without adding anything you
 * can see. These helpers pick what a pixel can show, and keep it honest: the rows they
 * return are real rows, never averages, so a spike in the data is a spike on screen.
 */

/**
 * Row indexes that draw the same line as every row, at `buckets` pixel columns. Per
 * column it keeps the first and last row and, for each series, the lowest and highest
 * value (the M4 method), so a line through the kept rows has every peak and dip the
 * full line has. One index set serves every series, so stacks stay aligned. A column
 * with a missing value keeps one, so gaps stay gaps. At most 4 rows a column come back
 * whole: there is nothing to save.
 */
export function sampleIndices(columns: (number | null)[][], length: number, buckets: number): number[] {
    const b = Math.max(1, Math.floor(buckets));
    if (length <= b * 4) return Array.from({ length }, (_, i) => i);
    const keep = new Uint8Array(length);
    for (let k = 0; k < b; k++) {
        const start = Math.floor((k * length) / b);
        const end = Math.floor(((k + 1) * length) / b);
        if (end <= start) continue;
        keep[start] = 1;
        keep[end - 1] = 1;
        for (const col of columns) {
            let lo = -1;
            let hi = -1;
            let gap = -1;
            for (let i = start; i < end; i++) {
                const v = col[i];
                if (v === null || v === undefined) {
                    if (gap < 0) gap = i;
                    continue;
                }
                if (lo < 0 || v < (col[lo] as number)) lo = i;
                if (hi < 0 || v > (col[hi] as number)) hi = i;
            }
            if (lo >= 0) keep[lo] = 1;
            if (hi >= 0) keep[hi] = 1;
            if (gap >= 0) keep[gap] = 1;
        }
    }
    const out: number[] = [];
    for (let i = 0; i < length; i++) if (keep[i]) out.push(i);
    return out;
}

/** Up to `max` row indexes spread evenly from the first row to the last: a readable digest of a long table. */
export function spreadIndices(length: number, max: number): number[] {
    if (length <= max) return Array.from({ length }, (_, i) => i);
    if (max <= 1) return length > 0 ? [0] : [];
    return Array.from({ length: max }, (_, i) => Math.round((i * (length - 1)) / (max - 1)));
}
