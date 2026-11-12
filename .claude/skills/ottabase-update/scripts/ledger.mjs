// The ledger, OTTABASE_LOCAL.md at the repo root: what this repo changed in upstream-owned code
// (docs/BUILDING_ON_OTTABASE.md). Read by apply.mjs and check.mjs. One markdown table row per change:
//
//   | `<id>` | patch | `<where it lives>` | why |
//   | `<id>` | owned | `<paths or globs>` | why |
//
//   patch  upstream code changed in place; every site carries a comment `ottabase-local: <id>`
//   owned  paths upstream no longer writes to: a file kept as this repo's own, or deleted on purpose

import fs from 'node:fs';

export const LEDGER = 'OTTABASE_LOCAL.md';
const KINDS = ['patch', 'owned'];

/** `{ rows: [{ id, kind, paths, line }], invalid: string[] }`; lines that are not `| \`id\` | ...` rows are prose. */
export function readLedger() {
    const rows = [];
    const invalid = [];
    if (!fs.existsSync(LEDGER)) return { rows, invalid };
    fs.readFileSync(LEDGER, 'utf8')
        .split(/\r?\n/)
        .forEach((raw, index) => {
            const cells = raw.split('|').map((cell) => cell.trim());
            const id = /^`([a-z0-9][a-z0-9-]*)`$/.exec(cells[1] ?? '')?.[1];
            if (!id) return;
            const kind = (cells[2] ?? '').replace(/`/g, '');
            const paths = [...(cells[3] ?? '').matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
            const where = `${LEDGER}:${index + 1}: \`${id}\``;
            if (!KINDS.includes(kind)) invalid.push(`${where} has kind "${kind}"; use ${KINDS.join(' or ')}`);
            else if (rows.some((row) => row.id === id)) invalid.push(`${where} is listed twice`);
            else if (kind === 'owned' && !paths.length)
                invalid.push(`${where} is owned but names no path in backticks`);
            else rows.push({ id, kind, paths, line: index + 1 });
        });
    return { rows, invalid };
}

/** Matcher for ledger paths: an exact file, a folder (everything under it), or a glob (`*`, `**`, `?`). */
export function pathMatcher(paths) {
    const tests = paths.map((raw) => {
        const entry = raw.replace(/\/+$/, '');
        const glob = new RegExp(
            '^' +
                entry
                    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                    .replace(/\*\*\/?/g, '\u0000')
                    .replace(/\*/g, '[^/]*')
                    .replace(/\?/g, '[^/]')
                    .replace(/\u0000/g, '.*') +
                '$',
        );
        return (file) => file === entry || file.startsWith(`${entry}/`) || glob.test(file);
    });
    return (file) => tests.some((test) => test(file));
}
