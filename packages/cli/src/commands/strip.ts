import fs from 'fs-extra';
import path from 'path';
import { getMonorepoRoot, log, resolveApp } from '../utils/index.js';
import { findPackageDescriptor, type PackageDescriptor } from './add.js';
import { FOOTPRINTS_FILE, PACKAGE_KEY, readFootprints, stripClosure, type Footprints } from './footprints.js';

/**
 * `otta strip <demo|package…> [app]`: the inverse of `otta add`.
 *
 * An app built from the otta-web template carries every package and the demo gallery. Stripping one
 * takes it out for good: the dependency, the composition, the entry in `ottabase/packages.ts`, the
 * client descriptor, the table re-exports, and the files that belong to it. Two things say which
 * lines and files those are:
 *
 * 1. **The app's footprint map**, `ottabase/footprints.json` (see footprints.ts):
 *
 *    ```json
 *    {
 *        "ottablog": { "paths": ["src/pages/blog", "worker/routes/blog.ts"] },
 *        "comments": { "needs": ["ottablog"], "paths": ["src/hooks/commentHooks.ts"] },
 *        "demo": { "paths": ["src/pages/demo", "worker/fixtures"], "dependencies": ["three"] }
 *    }
 *    ```
 *
 * 2. **Markers in shared files**, for the lines a package owns inside a file the app keeps (a route
 *    in the router, a nav entry, a `packages.has()` branch in the Worker):
 *
 *    ```ts
 *    import { x } from './x'; // otta:only ottablog          one line
 *    // otta:begin ottablog                                   a block, through the matching end
 *    const blogRoute = ...;
 *    // otta:end ottablog
 *    /* otta:unless demo                                      kept commented out until demo is stripped
 *    export function HomePage() { return <Starter />; }
 *    otta:end demo *\/
 *    ```
 *
 *    A marker may name several keys (`otta:only ottablog shortlinks` on an import both use): the line
 *    goes when the last of them does. Markers for a package that stays are left in place, so the app
 *    keeps its own map. A key that cannot stay without another (`needs` in the footprint map) needs
 *    no marker of its own on the lines they share: it is stripped along.
 *
 * What `otta add` wrote (the wiring) is found by shape, not by marker, so a package added later can
 * be stripped too. A package's shipped pages are deleted only when they are still the shipped copy.
 */
export interface StripStep {
    file: string;
    action: 'delete' | 'edit' | 'skip';
    detail: string;
    /** Full content to write for `edit`. */
    content?: string;
}

export interface StripPlan {
    app: string;
    appDir: string;
    /** Every key removed: the ones asked for plus the ones that needed them. */
    keys: string[];
    steps: StripStep[];
}

/** `otta:only k`, `otta:begin k`, `otta:end k`, `otta:unless k`; several keys separated by spaces or commas. */
const MARKER = /otta:(only|begin|end|unless)\s+([a-z0-9-]+(?:[\s,]+[a-z0-9-]+)*)/;
/** Folders never scanned for markers: build output, dependencies, binary assets. */
const SKIP_DIRS = new Set(['node_modules', 'dist', '.wrangler', '.turbo', 'coverage', '.git', '.next', 'public']);
const TEXT = /\.(?:[cm]?[jt]sx?|jsonc?|md|css|html|ya?ml|txt|example)$/;

const eolOf = (source: string) => (source.includes('\r\n') ? '\r\n' : '\n');
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeKeys = (list: string) =>
    list
        .split(/[\s,]+/)
        .filter(Boolean)
        .sort()
        .join(' ');

/**
 * Apply the markers of `source` for the stripped keys: `only` lines go, `begin … end` blocks go,
 * `unless … end` wrappers go (what they enclosed stays, now live). Markers for other keys are kept.
 */
export function stripMarkers(source: string, stripped: Set<string>): { content: string; errors: string[] } {
    const eol = eolOf(source);
    const lines = source.split(/\r?\n/);
    const out: string[] = [];
    const errors: string[] = [];
    // Several keys on one marker: the line is shared by them all and goes when the last one goes.
    const hit = (keys: string) => keys.split(' ').every((key) => stripped.has(key));
    /** Blocks of kept keys that are open at the current line; a block of a stripped key is skipped whole. */
    const open: { keys: string; line: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
        const match = MARKER.exec(lines[i]);
        if (!match) {
            out.push(lines[i]);
            continue;
        }
        const [, kind, rawKeys] = match;
        const keys = normalizeKeys(rawKeys);
        if (kind === 'only') {
            if (!hit(keys)) out.push(lines[i]);
            continue;
        }
        if (kind === 'end') {
            if (open.at(-1)?.keys === keys) open.pop();
            else errors.push(`line ${i + 1}: otta:end ${keys} without a begin`);
            out.push(lines[i]);
            continue;
        }
        if (!hit(keys)) {
            // A kept block: its lines are processed one by one, so a stripped block nested in it still goes.
            open.push({ keys, line: i + 1 });
            out.push(lines[i]);
            continue;
        }
        // begin or unless of a stripped key: find the matching end for the same keys.
        let end = -1;
        let depth = 0;
        for (let j = i + 1; j < lines.length; j++) {
            const inner = MARKER.exec(lines[j]);
            if (!inner || normalizeKeys(inner[2]) !== keys) continue;
            if (inner[1] === 'begin' || inner[1] === 'unless') depth++;
            else if (inner[1] === 'end') {
                if (depth === 0) {
                    end = j;
                    break;
                }
                depth--;
            }
        }
        if (end < 0) {
            errors.push(`line ${i + 1}: otta:${kind} ${keys} has no matching otta:end ${keys}`);
            out.push(lines[i]);
            continue;
        }
        if (kind === 'unless') for (let j = i + 1; j < end; j++) out.push(lines[j]);
        i = end;
    }
    for (const block of open)
        errors.push(`line ${block.line}: otta:begin ${block.keys} has no matching otta:end ${block.keys}`);
    return { content: out.join(eol), errors };
}

/** Every text file under `dir`, skipping what is never a source file. */
export function* walkText(dir: string): Generator<string> {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walkText(file);
        else if (TEXT.test(entry.name)) yield file;
    }
}

/** Remove the `export { … } from '<from>';` statement, single or multi-line. Null when there is none. */
function removeSchemaExport(source: string, from: string): string | null {
    const lines = source.split(/\r?\n/);
    const marker = `from '${from}';`;
    const at = lines.findIndex((line) => line.trimEnd().endsWith(marker));
    if (at < 0) return null;
    // Walk up to the statement's first line; only an `export { … }` statement is ours to remove.
    let start = at;
    while (start > 0 && !/^(?:export|import)\b/.test(lines[start])) start--;
    if (!/^export\s*\{/.test(lines[start])) return null;
    lines.splice(start, at - start + 1);
    return lines.join(eolOf(source));
}

/** Remove `definePackageClient({ key: '<key>' … })` and prune the lucide icons nothing else uses. */
function removeClientEntry(source: string, key: string): string | null {
    const eol = eolOf(source);
    const lines = source.split(/\r?\n/);
    const keyLine = new RegExp(`^\\s*(?:definePackageClient\\(\\{\\s*)?key:\\s*'${escapeRegex(key)}'`);
    const at = lines.findIndex((line) => keyLine.test(line));
    if (at < 0) return null;
    let start = at;
    while (start > 0 && !/^\s*definePackageClient\(\{/.test(lines[start])) start--;
    const indent = /^\s*/.exec(lines[start])?.[0] ?? '';
    let end = at;
    if (!/\}\),?\s*$/.test(lines[start])) {
        end = lines.findIndex((line, index) => index > at && line.startsWith(`${indent}}),`));
        if (end < 0) return null;
    }
    lines.splice(start, end - start + 1);
    // Icons: keep every imported name still mentioned somewhere other than the import line.
    const importAt = lines.findIndex((line) => /^import \{[^}]*\} from 'lucide-react';$/.test(line));
    if (importAt >= 0) {
        const names = (/\{([^}]*)\}/.exec(lines[importAt])?.[1] ?? '')
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean);
        const rest = lines.filter((_, index) => index !== importAt).join('\n');
        const used = names.filter((name) => new RegExp(`(?<![\\w$])${escapeRegex(name)}(?![\\w$])`).test(rest));
        if (used.length === 0) lines.splice(importAt, 1);
        else lines[importAt] = `import { ${used.join(', ')} } from 'lucide-react';`;
    }
    return lines.join(eol);
}

/** Work out every file change for stripping `requested` from the app, without touching anything. */
export function planStrip(root: string, appName: string, requested: string[]): StripPlan {
    const appDir = path.join(root, 'apps', appName);
    if (!fs.existsSync(path.join(appDir, 'package.json'))) throw new Error(`App "${appName}" has no package.json.`);
    for (const key of requested) if (!PACKAGE_KEY.test(key)) throw new Error(`"${key}" is not a package key.`);
    const footprints: Footprints = readFootprints(appDir);
    const keys = stripClosure(footprints, requested);
    const stripped = new Set(keys);
    const steps: StripStep[] = [];
    const rel = (file: string) => path.relative(root, file).split(path.sep).join('/');
    const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
    const edits = new Map<string, string>();
    const current = (file: string) => edits.get(file) ?? read(file);
    const edit = (file: string, detail: string, content: string) => {
        edits.set(file, content);
        steps.push({ file: rel(file), action: 'edit', detail, content });
    };
    const deleted = new Set<string>();
    const remove = (file: string, detail: string) => {
        if (deleted.has(file)) return;
        deleted.add(file);
        steps.push({ file: rel(file), action: 'delete', detail });
    };
    const isDeleted = (file: string) =>
        deleted.has(file) || [...deleted].some((gone) => file.startsWith(gone + path.sep));

    const pkgJsonFile = path.join(appDir, 'package.json');
    const listFile = path.join(appDir, 'ottabase', 'packages.ts');
    const clientFile = path.join(appDir, 'src', 'ottabase', 'config', 'packages.ts');
    const schemaFile = path.join(appDir, 'ottabase', 'db', 'schema.ts');
    const mainFile = path.join(appDir, 'src', 'main.tsx');
    const dropDependencies = new Set<string>();

    // What `otta add` wrote for the package: the composition, the list entry, the client entry, the
    // table re-exports, the error reporter, and its shipped pages while they are still the shipped copy.
    const stripWiring = (pkg: PackageDescriptor): void => {
        const composition = path.join(appDir, 'ottabase', 'packages', `${pkg.key}.ts`);
        if (fs.existsSync(composition)) remove(composition, 'composition');

        const list = current(listFile);
        if (list !== null && list.includes(`./packages/${pkg.key}'`)) {
            const lines = list.split(/\r?\n/);
            const importAt = lines.findIndex((line) => line.includes(`from './packages/${pkg.key}'`));
            const exported = /import \{ (\w+) \}/.exec(lines[importAt] ?? '')?.[1] ?? pkg.export;
            const kept = lines.filter(
                (line, index) => index !== importAt && line.replace(/\/\/.*$/, '').trim() !== `${exported},`,
            );
            edit(listFile, `unlist ${exported}`, kept.join(eolOf(list)));
        }

        const client = current(clientFile);
        if (client !== null) {
            const updated = removeClientEntry(client, pkg.key);
            if (updated !== null && updated !== client) edit(clientFile, `drop client key '${pkg.key}'`, updated);
        }

        if (pkg.tables) {
            const schema = current(schemaFile);
            const updated = schema === null ? null : removeSchemaExport(schema, pkg.tables.import);
            if (updated !== null && updated !== schema)
                edit(schemaFile, `drop ${pkg.tables.names.join(', ')}`, updated);
        }

        if (pkg.errorReporter) {
            const main = current(mainFile);
            if (main !== null) {
                const name = escapeRegex(pkg.errorReporter.export);
                const updated = main
                    .split(/\r?\n/)
                    .filter((line) => !new RegExp(`^import \\{ ${name} \\} from .*;$`).test(line))
                    .join(eolOf(main))
                    .replace(
                        new RegExp(`<ErrorBoundary onError=\\{\\(error\\) => ${name}\\(error\\)\\}>`, 'g'),
                        '<ErrorBoundary>',
                    );
                if (updated !== main)
                    edit(mainFile, `root <ErrorBoundary> no longer reports to ${pkg.errorReporter.export}`, updated);
            }
        }

        const shippedDir = path.join(root, pkg.dir, 'app');
        if (fs.existsSync(shippedDir)) {
            for (const shipped of walkText(shippedDir)) {
                const target = path.join(appDir, path.relative(shippedDir, shipped));
                if (!fs.existsSync(target) || isDeleted(target)) continue;
                if (fs.readFileSync(target, 'utf8') === fs.readFileSync(shipped, 'utf8'))
                    remove(target, 'shipped page');
                else
                    steps.push({
                        file: rel(target),
                        action: 'skip',
                        detail: 'edited since it was copied; delete by hand',
                    });
            }
        }
    };

    for (const key of keys) {
        const footprint = footprints[key];
        const descriptor = findPackageDescriptor(root, key);
        if (!footprint && !descriptor) {
            throw new Error(
                `Nothing to strip: "${key}" is neither a workspace package nor a key in ${FOOTPRINTS_FILE}.`,
            );
        }
        if (descriptor) {
            dropDependencies.add(descriptor.name);
            stripWiring(descriptor);
        }
        for (const dependency of footprint?.dependencies ?? []) dropDependencies.add(dependency);
        for (const p of footprint?.paths ?? []) {
            const target = path.join(appDir, p);
            if (fs.existsSync(target))
                remove(target, `${key}: ${fs.statSync(target).isDirectory() ? 'folder' : 'file'}`);
            else steps.push({ file: rel(target), action: 'skip', detail: `${key}: already gone` });
        }
    }

    // The dependencies, in one edit.
    const appPkg = fs.readJsonSync(pkgJsonFile) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };
    const gone = [...dropDependencies].filter((name) => appPkg.dependencies?.[name] || appPkg.devDependencies?.[name]);
    if (gone.length > 0) {
        const raw = fs.readFileSync(pkgJsonFile, 'utf8');
        const updated = { ...appPkg };
        for (const field of ['dependencies', 'devDependencies'] as const) {
            if (!updated[field]) continue;
            updated[field] = { ...updated[field] };
            for (const name of gone) delete updated[field]![name];
        }
        const eol = eolOf(raw);
        edit(pkgJsonFile, `drop ${gone.join(', ')}`, JSON.stringify(updated, null, 4).replace(/\n/g, eol) + eol);
    }

    // The markers, in every text file the app keeps.
    for (const file of walkText(appDir)) {
        if (isDeleted(file)) continue;
        const source = current(file);
        if (source === null || !source.includes('otta:')) continue;
        const { content, errors } = stripMarkers(source, stripped);
        if (errors.length) throw new Error(`${rel(file)}: ${errors.join('; ')}`);
        if (content !== source) edit(file, 'markers', content);
    }

    // The footprint map forgets the keys, so a second strip has nothing to do.
    const footprintsFile = path.join(appDir, FOOTPRINTS_FILE);
    const forgotten = keys.filter((key) => footprints[key]);
    if (fs.existsSync(footprintsFile) && forgotten.length > 0) {
        const rest = Object.fromEntries(Object.entries(footprints).filter(([key]) => !stripped.has(key)));
        const eol = eolOf(fs.readFileSync(footprintsFile, 'utf8'));
        edit(footprintsFile, `forget ${forgotten.join(', ')}`, JSON.stringify(rest, null, 4).replace(/\n/g, eol) + eol);
    }

    return { app: appName, appDir, keys, steps };
}

export function applyStrip(root: string, plan: StripPlan): void {
    for (const step of plan.steps) {
        const file = path.join(root, step.file);
        if (step.action === 'delete') fs.removeSync(file);
        else if (step.action === 'edit' && step.content !== undefined) fs.writeFileSync(file, step.content);
    }
}

export function formatStripPlan(plan: StripPlan): string {
    const lines = [`Strip ${plan.keys.join(', ')} from ${plan.app}:`];
    for (const step of plan.steps) lines.push(`  ${step.action.padEnd(6)} ${step.file}  ${step.detail}`);
    return lines.join('\n');
}

/** `otta strip <key…> [app]`: take the demo or a package out of an app. */
export async function stripPackages(
    requested: string[],
    appName?: string,
    options: { dryRun?: boolean } = {},
): Promise<StripPlan> {
    const root = getMonorepoRoot();
    const app = resolveApp(appName);
    const plan = planStrip(root, app.name, requested);
    const forced = plan.keys.filter((key) => !requested.includes(key));
    if (forced.length) log.dim(`${forced.join(', ')} cannot stay without ${requested.join(', ')}: stripped too.\n`);
    console.log(formatStripPlan(plan));
    if (options.dryRun) {
        log.dim('\nDry run: nothing written.');
        return plan;
    }
    applyStrip(root, plan);
    console.log('');
    if (!plan.steps.some((step) => step.action !== 'skip')) {
        log.done(`${plan.keys.join(', ')} already absent from ${app.name}.`);
        return plan;
    }
    log.done(`${plan.keys.join(', ')} stripped from ${app.name}.`);
    log.next('');
    ['pnpm install', `otta type-check ${app.name} && otta lint ${app.name} && otta test ${app.name}`].forEach(
        (step, index) => log.dim(`  ${index + 1}. ${step}`),
    );
    return plan;
}
