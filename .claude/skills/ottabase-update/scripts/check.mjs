#!/usr/bin/env node
// Do the ledger (OTTABASE_LOCAL.md) and the code still agree?
//
//   node .claude/skills/ottabase-update/scripts/check.mjs
//
// Fails (exit 1) on:
//   Lost        a `patch` row with no marker left in the code: what an update that dropped the change looks like
//   Unrecorded  a marker in the code whose id has no row
//   a malformed row
// A repo with no ledger and no markers passes. The update skill runs this before and after an update; add
// it to CI if you want a dropped change to fail the build between updates too.
//
// Markers are read from code only: markdown and llms*.txt are skipped, so docs can show examples.

import { execFileSync } from 'node:child_process';
import { LEDGER, readLedger } from './ledger.mjs';

// Always check the whole repo, from its root, wherever this was started.
process.chdir(execFileSync('git', ['rev-parse', '--show-cdup'], { encoding: 'utf8' }).trim() || '.');
const { rows, invalid } = readLedger();

let found = '';
try {
    found = execFileSync(
        'git',
        [
            ...['-c', 'core.quotePath=false', 'grep', '-I', '-n', '-o', '--untracked'],
            ...['-E', 'ottabase-local:[[:space:]]*[a-z0-9][a-z0-9-]*'],
            ...['--', '.', ':(exclude,icase)*.md', ':(exclude)*llms*.txt'],
        ],
        { encoding: 'utf8', maxBuffer: 1 << 26 },
    );
} catch (error) {
    if (error.status !== 1) throw error; // 1: no match
}
const sites = new Map(); // id -> ["file:line"]
for (const line of found.split('\n')) {
    const match = /^(.+):(\d+):ottabase-local:\s*([a-z0-9-]+)$/.exec(line.trim());
    if (match) sites.set(match[3], [...(sites.get(match[3]) ?? []), `${match[1]}:${match[2]}`]);
}

const problems = [...invalid];
for (const row of rows) {
    if (row.kind === 'patch' && !sites.has(row.id))
        problems.push(
            `Lost: \`${row.id}\` (${LEDGER}:${row.line}) has no marker left in the code. ` +
                'Re-apply it, or delete the row if upstream now covers it.',
        );
}
for (const [id, where] of sites) {
    if (!rows.some((row) => row.id === id))
        problems.push(`Unrecorded: marker \`${id}\` (${where.join(', ')}) has no row in ${LEDGER}.`);
}

for (const problem of problems) console.error(problem);
if (problems.length) process.exit(1);
console.log(
    rows.length
        ? `${LEDGER}: ${rows.length} local changes recorded, every patch still marked in the code.`
        : 'No local changes to upstream code are recorded or marked.',
);
