#!/usr/bin/env node
// ============================================================
// Writes worker/corpus.generated.json: the documentation the Worker serves
// ============================================================
// The pages are the ones llms.txt indexes (collectSections in @ottabase/scripts: the
// start-here pages, docs/*.md, every packages/*/README.md), so the two can never list
// different docs, plus the agent skills under .claude/skills.
//
// Only paths named here are read. Nothing is globbed from outside them, so a private or
// git-ignored file elsewhere in a checkout can never reach the public server.
// ============================================================

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectSections, extractSummary, extractTitle, stripNonProse } from '@ottabase/scripts/gen-llms';
// Node runs the TypeScript as is (type stripping, Node 24): one indexer for the build and the tests.
import { indexDocs } from './indexer.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const OUT = path.resolve(HERE, '../worker/corpus.generated.json');

const KIND_OF = { 'Start here': 'start', Guides: 'guide', Packages: 'package' };

const lf = (text) => text.replace(/\r\n?/g, '\n');

/** A skill's frontmatter `description`, which may run over several indented lines. */
function skillDescription(markdown) {
    if (!markdown.startsWith('---\n')) return '';
    const end = markdown.indexOf('\n---', 4);
    if (end === -1) return '';
    const lines = markdown.slice(4, end).split('\n');
    const at = lines.findIndex((line) => line.startsWith('description:'));
    if (at === -1) return '';
    const parts = [lines[at].slice('description:'.length)];
    for (const line of lines.slice(at + 1)) {
        if (!/^\s+\S/.test(line)) break;
        parts.push(line);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

async function collectSkills(repoRoot) {
    const dir = '.claude/skills';
    let names;
    try {
        names = await fs.readdir(path.join(repoRoot, dir));
    } catch {
        return [];
    }
    const docs = [];
    for (const name of names.sort()) {
        const id = `${dir}/${name}/SKILL.md`;
        let raw;
        try {
            raw = lf(await fs.readFile(path.join(repoRoot, id), 'utf8'));
        } catch {
            continue; // a file beside the skill folders, such as the index README
        }
        const body = stripNonProse(raw).trim();
        docs.push({
            id,
            kind: 'skill',
            title: `${extractTitle(raw, name)} (skill: ${name})`,
            summary: (skillDescription(raw) || extractSummary(raw)).slice(0, 300),
            body,
        });
    }
    return docs;
}

function revision(repoRoot) {
    try {
        return (
            execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim() || null
        );
    } catch {
        return null; // not a git checkout (a tarball build): the corpus is still right, only unlabeled
    }
}

export async function buildCorpus(repoRoot = REPO_ROOT) {
    const sections = await collectSections(repoRoot);
    const docs = [];
    for (const section of sections) {
        const kind = KIND_OF[section.heading];
        if (!kind)
            throw new Error(`build-corpus: gen-llms returned a section this script does not know: ${section.heading}`);
        for (const entry of section.entries) {
            docs.push({ id: entry.rel, kind, title: entry.title, summary: entry.summary, body: lf(entry.body).trim() });
        }
    }
    docs.push(...(await collectSkills(repoRoot)));
    return { generatedAt: new Date().toISOString(), revision: revision(repoRoot), docs, ...indexDocs(docs) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const corpus = await buildCorpus();
    await fs.writeFile(OUT, JSON.stringify(corpus), 'utf8');
    const bytes = corpus.docs.reduce((n, doc) => n + doc.body.length, 0);
    console.log(
        `build-corpus: ${corpus.docs.length} docs (${(bytes / 1024).toFixed(0)} KB), ${corpus.sections.length} sections, ${corpus.postings.length} words → worker/corpus.generated.json`,
    );
}
