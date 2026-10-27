import { execFileSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { getMonorepoRoot, log, resolveApp } from '../utils/index.js';
import { addPackage } from './add.js';

/**
 * `otta pro update [app]`: a buyer's Ottabase Pro update, in one command.
 *
 * Pro arrives as a git subtree at `packages/pro` (the Pro README's install); a release is a tag on
 * the private repository. The update is three steps a buyer otherwise types by hand, in order:
 *
 *   1. `git subtree pull --prefix=packages/pro <repo> <tag> --squash`: the new source, as one merge.
 *   2. `otta add pro <app>`: wiring for anything new in the release (a new package, a new page);
 *      it never overwrites what the app already has.
 *   3. The release notes: the CHANGELOG entry for the tag, so the migrations and the breaking
 *      changes it names are read, not discovered.
 *
 * A dirty tree, a nested repository at packages/pro (the maintainer's layout) or a missing subtree
 * stop it before anything is pulled.
 */
export interface ProUpdateOptions {
    /** A release tag (`v1.2.0`); default: the newest `v*` tag on the repository. */
    tag?: string;
    /** The Pro repository; default: the one the Pro README documents. */
    repo?: string;
    /** Print what would be pulled, pull nothing. */
    dryRun?: boolean;
}

export const PRO_REPO = 'https://github.com/ottabase/pro.git';
export const PRO_PREFIX = 'packages/pro';

/** A git runner, injectable for tests. Returns stdout. */
export type Git = (args: string[], cwd: string) => string;

const defaultGit: Git = (args, cwd) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** The newest `v<semver>` tag in `git ls-remote --tags --refs` output, or null. */
export function latestProTag(lsRemote: string): string | null {
    const tags = [...lsRemote.matchAll(/refs\/tags\/(v\d+\.\d+\.\d+)$/gm)].map((m) => m[1]);
    const key = (tag: string) => tag.slice(1).split('.').map(Number);
    tags.sort((a, b) => {
        const [x, y] = [key(a), key(b)];
        return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
    });
    return tags.at(-1) ?? null;
}

/** The CHANGELOG section for `tag` (`## [1.2.0]`, `## v1.2.0`, `## 1.2.0 …`), or the Unreleased one, or null. */
export function changelogEntry(changelog: string, tag: string): string | null {
    const version = tag.replace(/^v/, '');
    const lines = changelog.split(/\r?\n/);
    const heading = new RegExp(`^## \\[?v?${version.replace(/\./g, '\\.')}\\]?(?:\\s|$)`);
    let start = lines.findIndex((line) => heading.test(line));
    if (start < 0) start = lines.findIndex((line) => /^## \[?Unreleased\]?/i.test(line));
    if (start < 0) return null;
    let end = lines.findIndex((line, index) => index > start && /^## /.test(line));
    if (end < 0) end = lines.length;
    return lines.slice(start, end).join('\n').trim();
}

/** The "Needs public Ottabase main of <date> or later" sentence a Pro entry carries, when it does. */
export function requiredPublicVersion(entry: string): string | null {
    return /Needs public Ottabase[^.]*\./.exec(entry)?.[0] ?? null;
}

export interface ProUpdateResult {
    tag: string;
    pulled: boolean;
    entry: string | null;
}

export async function proUpdate(
    root: string,
    appName: string,
    options: ProUpdateOptions = {},
    git: Git = defaultGit,
): Promise<ProUpdateResult> {
    const repo = options.repo ?? PRO_REPO;
    const proDir = path.join(root, PRO_PREFIX);
    if (!fs.existsSync(proDir)) {
        throw new Error(`${PRO_PREFIX} is not here. Install Pro first (git subtree add; see the Pro README).`);
    }
    if (fs.existsSync(path.join(proDir, '.git'))) {
        throw new Error(`${PRO_PREFIX} is a repository of its own, not a subtree: update it with git pull inside it.`);
    }
    if (git(['status', '--porcelain'], root).trim()) {
        throw new Error('The working tree has changes. Commit or stash them: the update is a merge.');
    }

    const tag = options.tag ?? latestProTag(git(['ls-remote', '--tags', '--refs', repo], root));
    if (!tag) throw new Error(`No v* release tag found on ${repo}.`);
    if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error(`"${tag}" is not a release tag (vX.Y.Z).`);
    log.step(`Ottabase Pro ${tag} from ${repo}`);

    if (options.dryRun) {
        log.dim(`  would run: git subtree pull --prefix=${PRO_PREFIX} ${repo} ${tag} --squash`);
        log.dim(`  then: otta add pro ${appName}`);
        return { tag, pulled: false, entry: null };
    }

    // 1. The source.
    git(['subtree', 'pull', `--prefix=${PRO_PREFIX}`, repo, tag, '--squash'], root);
    log.success(`pulled ${tag} into ${PRO_PREFIX}`);

    // 2. The wiring for what is new. Never overwrites.
    await addPackage('pro', appName);

    // 3. The release notes.
    const changelogFile = path.join(proDir, 'CHANGELOG.md');
    const entry = fs.existsSync(changelogFile) ? changelogEntry(fs.readFileSync(changelogFile, 'utf8'), tag) : null;
    return { tag, pulled: true, entry };
}

/** `otta pro update [app]`. */
export async function proUpdateCommand(appName: string | undefined, options: ProUpdateOptions = {}): Promise<void> {
    const root = getMonorepoRoot();
    const app = resolveApp(appName);
    const result = await proUpdate(root, app.name, options);
    console.log('');
    if (!result.pulled) {
        log.done(`dry run: Pro ${result.tag} would be pulled.`);
        return;
    }
    if (result.entry) {
        console.log(result.entry);
        console.log('');
        const needs = requiredPublicVersion(result.entry);
        if (needs) log.warn(`${needs} Update public Ottabase first if this repository is older.`);
    }
    log.done(`Ottabase Pro ${result.tag} is in ${PRO_PREFIX} and wired into ${app.name}.`);
    log.next('');
    [
        'pnpm install && pnpm build:pkg',
        `otta type-check ${app.name} && otta test ${app.name}`,
        'Run the migrations in each environment: Admin → Infrastructure → Migrations, or POST /api/ottaorm/init with MIGRATION_SECRET',
        `git commit -am "Update Ottabase Pro to ${result.tag}"`,
    ].forEach((step, index) => log.dim(`  ${index + 1}. ${step}`));
}
