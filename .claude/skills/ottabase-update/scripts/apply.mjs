#!/usr/bin/env node
// Apply what upstream changed between two commits onto this repo, one file at a time, with a
// three-way fallback. Part of the ottabase-update skill (SKILL.md, step 4). Run from the repo root:
//
//   node .claude/skills/ottabase-update/scripts/apply.mjs <clone> <from> <to> [--into <dir>]
//
//   <clone>        the upstream clone, e.g. .upstream/ottabase
//   <from> <to>    upstream commits (or tags): the recorded base, and the version to reach
//   --into <dir>   apply under a folder of this repo (Ottabase Pro: packages/pro)
//
// It reads `apps` in this repo's `.ottabase-upstream.json` (upstream app folder -> this repo's, e.g.
// {"otta-web": "my-app"}) and the `owned` rows of the ledger (OTTABASE_LOCAL.md): upstream changes to
// an owned path are not applied, only listed. Results go to .upstream/run/<clone name>/: clean,
// conflict, owned, failed, skipped, generated, plus apply.log. The tree must be clean when it starts.
//
// Plain Node and git, no dependencies: it has to work while the update is rewriting the repo's own
// packages, CLI included.

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathMatcher, readLedger } from './ledger.mjs';

const args = process.argv.slice(2);
const intoIndex = args.indexOf('--into');
const into = intoIndex >= 0 ? (args.splice(intoIndex, 2)[1] ?? '').replace(/\/+$/, '') : '';
const [clone, from, to] = args;
if (!clone || !from || !to || (intoIndex >= 0 && !into)) {
    console.error('usage: node apply.mjs <clone> <from> <to> [--into <dir>]');
    process.exit(2);
}

// Every git call sees the clone's objects, so the three-way fallback can read upstream's file versions
// without pulling upstream history into this repo. File names are taken literally: `[id]` and
// `[...slug]` are folders, not globs, and non-ASCII names are not quoted.
const env = {
    ...process.env,
    GIT_ALTERNATE_OBJECT_DIRECTORIES: path.resolve(clone, '.git', 'objects'),
    GIT_LITERAL_PATHSPECS: '1',
};
const git = (argv) =>
    execFileSync('git', ['-c', 'core.quotePath=false', ...argv], { encoding: 'utf8', maxBuffer: 1 << 28, env });

if (git(['rev-parse', '--show-prefix']).trim()) {
    console.error('Run this from the repo root.');
    process.exit(1);
}
if (git(['status', '--porcelain']).trim()) {
    console.error('The working tree is not clean. Commit or stash first: the apply must start from a known state.');
    process.exit(1);
}

// ---- this repo's side: renamed apps, and the paths it owns ----
const record = fs.existsSync('.ottabase-upstream.json')
    ? JSON.parse(fs.readFileSync('.ottabase-upstream.json', 'utf8'))
    : {};
const appMap = record.apps && typeof record.apps === 'object' ? record.apps : {};
const isOwned = pathMatcher(
    readLedger()
        .rows.filter((row) => row.kind === 'owned')
        .flatMap((row) => row.paths),
);

// ---- output ----
const out = path.join('.upstream', 'run', path.basename(path.resolve(clone)));
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const lists = { clean: [], conflict: [], owned: [], failed: [], skipped: [], generated: [] };
const logFile = path.join(out, 'apply.log');
const patchFile = path.join(out, 'one.patch');

const GENERATED = new Set(['pnpm-lock.yaml', 'llms.txt', 'llms-full.txt']);

const changed = git(['-C', clone, 'diff', '--name-only', '--no-renames', from, to]).split('\n').filter(Boolean);
const applied = []; // [target, exit status of git apply]
for (const file of changed) {
    let target = into ? `${into}/${file}` : file;
    const applyArgs = ['apply', '--3way'];
    if (into) applyArgs.push(`--directory=${into}`);

    if (!into && GENERATED.has(file)) {
        lists.generated.push(file);
        continue;
    }
    const app = !into && /^apps\/([^/]+)\//.exec(file);
    if (app) {
        const local = appMap[app[1]] ?? app[1];
        if (!fs.existsSync(path.join('apps', local))) {
            lists.skipped.push(file);
            continue;
        }
        if (local !== app[1]) {
            target = `apps/${local}/${file.slice(app[0].length)}`;
            applyArgs.push('-p3', `--directory=apps/${local}`);
        }
    }
    if (isOwned(target)) {
        lists.owned.push(target);
        continue;
    }

    fs.writeFileSync(patchFile, git(['-C', clone, 'diff', '--binary', '--no-renames', from, to, '--', file]));
    const run = spawnSync('git', [...applyArgs, patchFile], { encoding: 'utf8', env });
    fs.appendFileSync(logFile, `## ${target}\n${run.stdout ?? ''}${run.stderr ?? ''}\n`);
    applied.push([target, run.status]);
}
const unmerged = new Set(git(['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean));
for (const [target, status] of applied)
    (unmerged.has(target) ? lists.conflict : status === 0 ? lists.clean : lists.failed).push(target);

// `git apply --3way` leaves index entries pointing at blobs that live only in the clone; without
// them `git status` and every tool after it fail with "unable to read <sha>". Reset the index to
// HEAD (the working tree keeps every change and conflict marker) while the clone is still visible.
git(['reset', '-q']);
git(['update-index', '--clear-resolve-undo']);
fs.rmSync(patchFile, { force: true });

for (const [name, files] of Object.entries(lists))
    fs.writeFileSync(path.join(out, name), files.map((f) => `${f}\n`).join(''));
console.log(`${changed.length} upstream files, results in ${out.replace(/\\/g, '/')}/`);
for (const [name, files] of Object.entries(lists)) console.log(`  ${name.padEnd(9)} ${files.length}`);
if (lists.conflict.length)
    console.log('Conflict markers are in the working tree; resolve each by who owns the path (SKILL.md).');
if (lists.owned.length) console.log('Upstream changed paths this repo owns; they were left alone. Read what changed.');
