#!/usr/bin/env node
// After an update: which of this repo's own changes did it lose? Part of the ottabase-update skill
// (SKILL.md, step 6). Run from the repo root, with the update applied in the working tree:
//
//   node .claude/skills/ottabase-update/scripts/regression-map.mjs <clone> <base> [<before>]
//
//   <clone>    the upstream clone, e.g. .upstream/ottabase
//   <base>     the upstream commit this repo was synced to BEFORE this update (the old base)
//   <before>   this repo's commit before the update (default HEAD; pass it once the update is committed)
//
// "This repo's own changes" are the diff from upstream <base> to <before> (with renamed apps mapped
// through `apps` in .ottabase-upstream.json). Every line they added that no longer appears verbatim
// in the same file of the working tree is listed, plus every file they touched that is now gone. The
// result, .upstream/run/regression-map.md, is a review list, not a verdict: most entries are
// upstream doing the same thing another way. Tests rarely catch the rest, so read it by area.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [clone, base, before = 'HEAD'] = process.argv.slice(2);
if (!clone || !base) {
    console.error('usage: node regression-map.mjs <clone> <base> [<before>]');
    process.exit(2);
}

const env = { ...process.env, GIT_ALTERNATE_OBJECT_DIRECTORIES: path.resolve(clone, '.git', 'objects') };
const git = (argv) =>
    execFileSync('git', ['-c', 'core.quotePath=false', ...argv], { encoding: 'utf8', maxBuffer: 1 << 30, env });
if (git(['rev-parse', '--show-prefix']).trim()) {
    console.error('Run this from the repo root.');
    process.exit(1);
}

const record = fs.existsSync('.ottabase-upstream.json')
    ? JSON.parse(fs.readFileSync('.ottabase-upstream.json', 'utf8'))
    : {};
const appMap = Object.entries(record.apps && typeof record.apps === 'object' ? record.apps : {});

// The repo's own delta: everything outside renamed apps, then each renamed app against its upstream folder.
let diff = git([
    'diff',
    '-U0',
    '--no-renames',
    base,
    before,
    '--',
    '.',
    ...appMap.flatMap(([up, local]) => [`:!apps/${up}`, `:!apps/${local}`]),
]);
for (const [up, local] of appMap) {
    diff += git([
        'diff',
        '-U0',
        '--no-renames',
        `${base}:apps/${up}`,
        `${before}:apps/${local}`,
        `--src-prefix=a/apps/${local}/`,
        `--dst-prefix=b/apps/${local}/`,
    ]);
}

const SKIP =
    /(^|\/)(pnpm-lock\.yaml|llms(-full)?\.txt|CHANGELOG\.md)$|\.(snap|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|pdf)$/i;
const files = new Map(); // path -> { status, added: string[] }
let current = null;
for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
        current = line.slice(line.indexOf(' b/') + 3);
        files.set(current, { status: 'M', added: [] });
    } else if (!current) continue;
    else if (line.startsWith('new file')) files.get(current).status = 'A';
    else if (line.startsWith('deleted file')) files.get(current).status = 'D';
    else if (line.startsWith('+') && !line.startsWith('+++')) files.get(current).added.push(line.slice(1));
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const trivial = (s) => norm(s).length < 4 || /^[\W_]*$/.test(norm(s));
const missingFiles = [];
const lost = [];
for (const [file, { status, added }] of files) {
    if (status === 'D' || SKIP.test(file)) continue;
    if (!fs.existsSync(file)) {
        missingFiles.push({ file, status, lines: added.length });
        continue;
    }
    const now = new Set(fs.readFileSync(file, 'utf8').split(/\r?\n/).map(norm));
    const gone = added.filter((l) => !trivial(l) && !now.has(norm(l)));
    if (gone.length) lost.push({ file, gone, total: added.length });
}

const area = (file) =>
    file.startsWith('apps/') || file.startsWith('packages/')
        ? file.split('/').slice(0, 2).join('/')
        : file.split('/')[0];
const byArea = new Map();
for (const { file, gone } of lost) byArea.set(area(file), (byArea.get(area(file)) ?? 0) + gone.length);

const report = [
    '# Regression map',
    '',
    `This repo's own changes (upstream ${base} -> ${before}) checked against the working tree.`,
    '',
    `- ${files.size} files changed by this repo, ${missingFiles.length} now missing, ${lost.length} with lines no longer present`,
    '',
    '## Lines no longer present, by area',
    '',
    ...[...byArea].sort((a, b) => b[1] - a[1]).map(([name, n]) => `- ${name}: ${n}`),
    '',
    '## Files this repo changed that are gone',
    '',
    ...missingFiles.map(({ file, status, lines }) => `- ${status} ${file} (${lines} added lines)`),
    '',
    '## Lost lines per file',
    '',
    ...lost.flatMap(({ file, gone, total }) => [
        `### ${file} (${gone.length}/${total})`,
        '',
        '```',
        ...gone,
        '```',
        '',
    ]),
].join('\n');

const outFile = path.join('.upstream', 'run', 'regression-map.md');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, report);
console.log(
    `${lost.length} files with lost lines, ${missingFiles.length} missing files -> ${outFile.replace(/\\/g, '/')}`,
);
