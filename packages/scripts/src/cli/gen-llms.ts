#!/usr/bin/env node
/**
 * gen-llms – Generate `/llms.txt` and `/llms-full.txt` from the repo's Markdown docs.
 *
 * Implements Ottabase design principle #25 ("Ottabase must be AI-native"): a curated,
 * machine-optimized index of the framework's documentation, regenerated from the SAME
 * source as the human docs so the two can never drift. Run it on every release.
 *
 *   - `llms.txt`       the llmstxt.org index: H1 + summary + linked sections (short context)
 *   - `llms-full.txt`  every indexed doc concatenated (full context for agents)
 *
 * Output is written to the repo root (these describe the framework, and otta-web is a
 * template whose public/ would carry them into every scaffolded app — copy into the
 * homepage/docs site's public/ to serve). Pure builders (extractTitle/extractSummary/
 * buildLlmsTxt/buildLlmsFull) are exported and unit-tested; `main()` is the only part
 * that touches the filesystem.
 */
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

/** One documentation source, already read off disk. */
export interface DocEntry {
    /** Repo-relative path (POSIX separators). Doubles as the link target in llms.txt. */
    rel: string;
    title: string;
    summary: string;
    body: string;
}

/** A named group of entries in the index (e.g. "Start here", "Guides", "Packages"). */
export interface DocSection {
    heading: string;
    entries: DocEntry[];
}

/** Project tagline shown as the llms.txt summary blockquote. Kept here (stable) rather
 *  than scraped, since AGENTS.MD's intro is wrapped in markup that is noisy to parse. */
const PROJECT_SUMMARY =
    'Ottabase is a Cloudflare-native foundation for shipping production SaaS, apps, and content sites: ' +
    'in-house auth, RBAC, an ORM over D1, forms, uploads, a blog/CMS, queues, realtime, RLS, and a runtime ' +
    'theming engine (Brand Engine), across 60+ packages that already know about each other.';

/** Curated, ordered top-level docs. Anything in docs/ not listed here lands under "Guides". */
const START_HERE = ['README.md', 'QUICKSTART.md', 'ARCHITECTURE.md', 'AGENTS.MD', 'docs/SOLO_FOUNDER_SAAS_GUIDE.md'];

/** Remove YAML frontmatter and HTML comments so title/summary scanning sees real prose. */
export function stripNonProse(md: string): string {
    let out = md;
    if (out.startsWith('---\n')) {
        const end = out.indexOf('\n---', 4);
        if (end !== -1) out = out.slice(end + 4);
    }
    return out.replace(/<!--[\s\S]*?-->/g, '');
}

/** First `# H1` text, else the provided fallback (used when a README has no heading). */
export function extractTitle(md: string, fallback: string): string {
    for (const line of stripNonProse(md).split('\n')) {
        const m = /^#\s+(.+?)\s*#*\s*$/.exec(line.trim());
        if (m) return m[1].trim();
    }
    return fallback;
}

/** First meaningful paragraph, collapsed to a single ≤200-char line. Skips headings,
 *  badge/image lines, blockquote markers, code fences, and HTML so the one-liner is clean. */
export function extractSummary(md: string): string {
    const lines = stripNonProse(md).split('\n');
    let inFence = false;
    for (const raw of lines) {
        const line = raw.trim();
        if (line.startsWith('```') || line.startsWith('~~~')) {
            inFence = !inFence;
            continue;
        }
        if (inFence || !line) continue;
        if (line.startsWith('#')) continue; // heading
        if (/^[>|]/.test(line)) {
            const quoted = line.replace(/^>\s?/, '').trim();
            if (quoted) return clampLine(quoted);
            continue;
        }
        if (/^!\[/.test(line) || /^\[!\[/.test(line)) continue; // badge / image line
        if (/^</.test(line)) continue; // raw HTML
        if (/^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) continue; // list item
        return clampLine(line);
    }
    return '';
}

/** Strip markdown link syntax to text, collapse whitespace, cap length at a word boundary. */
function clampLine(s: string): string {
    const plain = s
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
        .replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1') // unescape markdown escapes (keeps OBCF_D1 etc. intact)
        .replace(/[*`]/g, '') // drop bold/code markers (not `_`, which lives inside identifiers)
        .replace(/\s+/g, ' ')
        .trim();
    if (plain.length <= 200) return plain;
    const cut = plain.slice(0, 200);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 120 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/** Render the llmstxt.org index file from structured sections. */
export function buildLlmsTxt(opts: { title: string; summary: string; sections: DocSection[] }): string {
    const parts: string[] = [`# ${opts.title}`, '', `> ${opts.summary}`, ''];
    for (const section of opts.sections) {
        if (!section.entries.length) continue;
        parts.push(`## ${section.heading}`, '');
        for (const e of section.entries) {
            const desc = e.summary ? `: ${e.summary}` : '';
            parts.push(`- [${e.title}](${e.rel})${desc}`);
        }
        parts.push('');
    }
    return `${parts.join('\n').trimEnd()}\n`;
}

/** Render the full-context file: every indexed doc, concatenated with path headers. */
export function buildLlmsFull(opts: { title: string; summary: string; sections: DocSection[] }): string {
    const parts: string[] = [`# ${opts.title} — Full Documentation`, '', `> ${opts.summary}`, ''];
    for (const section of opts.sections) {
        for (const e of section.entries) {
            parts.push('', '---', '', `# ${e.rel}`, '', e.body.trim(), '');
        }
    }
    return `${parts.join('\n').trimEnd()}\n`;
}

/** Read one doc off disk into a DocEntry, or null if it does not exist. */
async function readDoc(repoRoot: string, rel: string): Promise<DocEntry | null> {
    const abs = path.join(repoRoot, rel);
    let body: string;
    try {
        body = await fs.readFile(abs, 'utf8');
    } catch {
        return null;
    }
    const posixRel = rel.split(path.sep).join('/');
    const fallbackTitle = path.basename(path.dirname(posixRel)) || posixRel;
    return { rel: posixRel, title: extractTitle(body, fallbackTitle), summary: extractSummary(body), body };
}

/** Every `docs/*.md` not already in START_HERE, sorted by filename. */
async function collectGuides(repoRoot: string): Promise<DocEntry[]> {
    const dir = 'docs';
    let names: string[];
    try {
        names = await fs.readdir(path.join(repoRoot, dir));
    } catch {
        return [];
    }
    const rels = names
        .filter((n) => n.toLowerCase().endsWith('.md'))
        .map((n) => `${dir}/${n}`)
        .filter((rel) => !START_HERE.includes(rel))
        .sort();
    return collectDocs(repoRoot, rels);
}

/** Every package README (packages/<pkg>/README.md), sorted by package name. */
async function collectPackageReadmes(repoRoot: string): Promise<DocEntry[]> {
    const dir = 'packages';
    let pkgs: string[];
    try {
        pkgs = await fs.readdir(path.join(repoRoot, dir));
    } catch {
        return [];
    }
    const rels = pkgs.sort().map((p) => `${dir}/${p}/README.md`);
    return collectDocs(repoRoot, rels);
}

/** Read a list of rel paths, dropping any that are missing. */
async function collectDocs(repoRoot: string, rels: string[]): Promise<DocEntry[]> {
    const entries = await Promise.all(rels.map((rel) => readDoc(repoRoot, rel)));
    return entries.filter((e): e is DocEntry => e !== null);
}

/** Assemble the three sections from disk. Exported for tests/reuse. */
export async function collectSections(repoRoot: string): Promise<DocSection[]> {
    const [startHere, guides, packages] = await Promise.all([
        collectDocs(repoRoot, START_HERE),
        collectGuides(repoRoot),
        collectPackageReadmes(repoRoot),
    ]);
    return [
        { heading: 'Start here', entries: startHere },
        { heading: 'Guides', entries: guides },
        { heading: 'Packages', entries: packages },
    ];
}

/** Walk up from `startPath` to the dir holding `pnpm-workspace.yaml` (the repo root).
 *  Matches the convention in help.ts and works from both CJS and ESM builds. */
export function findMonorepoRoot(startPath: string = process.cwd()): string {
    let current = path.resolve(startPath);
    for (;;) {
        if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current;
        const parent = path.dirname(current);
        if (parent === current) return path.resolve(startPath);
        current = parent;
    }
}

export async function main(): Promise<void> {
    const repoRoot = findMonorepoRoot();
    const sections = await collectSections(repoRoot);
    const opts = { title: 'Ottabase', summary: PROJECT_SUMMARY, sections };

    // Repo root, not an app's public/ dir: these describe the framework/monorepo, and otta-web
    // is a template — files under its public/ would ship into every scaffolded app's dist. The
    // llmstxt.org convention also expects /llms.txt at the project root for discoverability.
    await fs.writeFile(path.join(repoRoot, 'llms.txt'), buildLlmsTxt(opts), 'utf8');
    await fs.writeFile(path.join(repoRoot, 'llms-full.txt'), buildLlmsFull(opts), 'utf8');

    const count = sections.reduce((n, s) => n + s.entries.length, 0);
    console.log(`gen-llms: wrote llms.txt + llms-full.txt from ${count} docs → repo root`);
}
