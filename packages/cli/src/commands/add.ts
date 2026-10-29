import fs from 'fs-extra';
import path from 'path';
import { getMonorepoRoot, log, resolveApp } from '../utils/index.js';
import { readFootprints } from './footprints.js';

/**
 * What a package tells the CLI about itself, in its package.json `ottabase` field:
 *
 * ```json
 * "ottabase": {
 *     "key": "vault",
 *     "factory": "createVaultPackage",
 *     "export": "vaultPackage",
 *     "manifestImport": "@ottabase/vault",
 *     "tables": { "import": "@ottabase/vault/schema", "names": ["emailSuppressionsTable"] },
 *     "adminPages": [{
 *         "path": "/admin/infrastructure/tower", "title": "Tower", "description": "…", "icon": "Radar",
 *         "group": "infrastructure", "scope": "platform", "page": "admin/infrastructure/TowerPage", "export": "TowerPage"
 *     }]
 * }
 * ```
 *
 * `export` defaults to `<key>Package`; `manifestImport` to the package name; `tables` is omitted
 * when the package owns no Drizzle tables; `adminPages` when it renders no admin page. A package
 * may also ship an `app/` folder mirroring the app layout (`app/ottabase/packages/<key>.ts`,
 * `app/src/pages/…`): those files are copied into the app when it lacks them.
 *
 * Two more fields reach into the SPA shell, for packages that need it:
 *
 * ```json
 * "routes": [
 *     { "path": "/status", "page": "status/StatusPage", "export": "StatusPage", "access": "public" },
 *     { "path": "/billing", "page": "user/BillingPage", "export": "BillingPage",
 *       "menu": { "title": "Billing", "icon": "CreditCard" } }
 * ],
 * "errorReporter": { "import": "./lib/blackbox", "export": "captureException" }
 * ```
 *
 * `routes` join the client descriptor next to `adminPages`, and the app router mounts them from
 * there (`access` defaults to `protected`, a signed-in page); `menu` links the page from the
 * signed-in account menu. `notices` are the URL notices the package redirects with, keyed by a
 * kebab-case code (`{ "checkout-complete": { "type": "success", "message": "…" } }`); the app
 * registry namespaces them as `<key>.<code>`. `errorReporter` is handed every render error the root `<ErrorBoundary>`
 * in `src/main.tsx` catches.
 *
 * A package lives in `packages/<name>` or, inside a bundle such as Ottabase Pro, in
 * `packages/<bundle>/<name>`. `otta add <bundle>` wires every package of the bundle.
 */
export interface AdminPageDescriptor {
    path: string;
    title: string;
    description?: string;
    /** A lucide-react icon name. */
    icon?: string;
    group: string;
    scope?: string;
    /** A Premium Package's page: the sidebar entry carries a lock, the page renders its upsell unlicensed. */
    premium?: boolean;
    /** Page module under `src/pages`, without extension: `admin/infrastructure/TowerPage`. */
    page: string;
    export: string;
}

export interface RouteDescriptor {
    path: string;
    /** Page module under `src/pages`, without extension: `user/PlansPage`. */
    page: string;
    export: string;
    /** `protected` (the default) needs a session; `public` does not. */
    access?: 'public' | 'protected';
    /** A link in the signed-in account menu; `icon` is a lucide-react icon name. */
    menu?: { title: string; icon: string };
}

/** A URL notice a package redirects with (`?notice=<key>.<code>`). */
export interface NoticeDescriptor {
    type: 'success' | 'info' | 'warning' | 'error';
    title?: string;
    message: string;
    /** The package's own page renders it (claimNotice) instead of a toast. */
    inline?: boolean;
}

export interface PackageDescriptor {
    name: string;
    key: string;
    factory: string;
    export: string;
    manifestImport: string;
    /** The package folder relative to the monorepo root: `packages/vault`, `packages/pro/tower`. */
    dir: string;
    tables?: { import: string; names: string[] };
    adminPages?: AdminPageDescriptor[];
    routes?: RouteDescriptor[];
    notices?: Record<string, NoticeDescriptor>;
    /** A function the root `<ErrorBoundary>` hands every caught render error to; `import` is as `src/main.tsx` reads it. */
    errorReporter?: { import: string; export: string };
}

export interface AddStep {
    file: string;
    action: 'create' | 'edit' | 'skip';
    detail: string;
    /** Full content to write for `create`/`edit`; absent for `skip`. */
    content?: string;
}

export interface AddPlan {
    app: string;
    appDir: string;
    package: PackageDescriptor;
    steps: AddStep[];
}

const REFERENCE_APP = 'otta-web';
/** Where packages live: directly under packages/, or one bundle deeper. */
const PACKAGE_ROOTS = ['packages', 'packages/pro'];
const NAME = /^[a-z][a-z0-9-]*$/;
const ICON = /^[A-Z][A-Za-z0-9]*$/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
/** Words an import binding cannot be: `import { default } from …` does not parse. */
const RESERVED = new Set(
    (
        'break case catch class const continue debugger default delete do else enum export extends false finally for ' +
        'function if import in instanceof new null return super switch this throw true try typeof var void while with ' +
        'yield let static implements interface package private protected public await'
    ).split(' '),
);
const isBinding = (value: unknown): value is string =>
    typeof value === 'string' && IDENTIFIER.test(value) && !RESERVED.has(value);
const ROUTE_PATH = /^\/[a-z0-9/_-]*$/;
const NOTICE_CODE = /^[a-z][a-z0-9-]*$/;
const NOTICE_TYPES = new Set(['success', 'info', 'warning', 'error']);
/** A page module under the app's `src/pages`: path segments only, no `..`, nothing to escape. */
const PAGE = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/;

function camel(key: string): string {
    return key.replace(/[-_](\w)/g, (_, char: string) => char.toUpperCase());
}

const eolOf = (source: string) => (source.includes('\r\n') ? '\r\n' : '\n');

function bareName(requested: string): string {
    return requested.replace(/^@ottabase\//, '');
}

/** `packages/<bare>` or `packages/pro/<bare>`, whichever has a package.json; `pro/tower` is explicit. */
function packageDir(root: string, bare: string): string | null {
    const candidates = bare.includes('/') ? [`packages/${bare}`] : PACKAGE_ROOTS.map((base) => `${base}/${bare}`);
    return candidates.find((dir) => fs.existsSync(path.join(root, dir, 'package.json'))) ?? null;
}

/** `packages/<bare>` with no package.json of its own but packages inside: a bundle such as `pro`. */
export function listBundle(root: string, requested: string): string[] | null {
    const bare = bareName(requested);
    if (!NAME.test(bare)) return null;
    const dir = path.join(root, 'packages', bare);
    if (!fs.existsSync(dir) || fs.existsSync(path.join(dir, 'package.json'))) return null;
    const members = fs
        .readdirSync(dir)
        .filter((name) => NAME.test(name) && fs.existsSync(path.join(dir, name, 'package.json')))
        .sort()
        .map((name) => `${bare}/${name}`);
    return members.length > 0 ? members : null;
}

/** Read the package's `ottabase` descriptor. Accepts `vault`, `@ottabase/vault` or `pro/tower`. */
export function readPackageDescriptor(root: string, requested: string): PackageDescriptor {
    const bare = bareName(requested);
    const [bundle, member] = bare.split('/');
    if (!NAME.test(bundle) || (member !== undefined && !NAME.test(member)) || bare.split('/').length > 2) {
        throw new Error(`Invalid package name "${requested}".`);
    }
    const dir = packageDir(root, bare);
    if (!dir) throw new Error(`No workspace package at packages/${bare} or packages/pro/${bare}.`);
    const pkg = fs.readJsonSync(path.join(root, dir, 'package.json')) as {
        name?: string;
        ottabase?: Partial<PackageDescriptor>;
    };
    const meta = pkg.ottabase;
    if (!meta || typeof meta.key !== 'string' || typeof meta.factory !== 'string') {
        throw new Error(
            `${dir}/package.json has no "ottabase" descriptor ({ key, factory, export?, tables?, adminPages? }); ` +
                'add one, or wire the package by hand as docs/PACKAGE_CREATION_GUIDE.md describes.',
        );
    }
    if (!NAME.test(meta.key)) throw new Error(`Package key "${meta.key}" must be kebab-case.`);
    const name = pkg.name ?? `@ottabase/${member ?? bundle}`;
    const adminPages = Array.isArray(meta.adminPages) ? meta.adminPages : [];
    for (const page of adminPages) {
        const strings = [page.path, page.title, page.group, page.page, page.export];
        if (strings.some((value) => typeof value !== 'string' || value.length === 0)) {
            throw new Error(`${dir}/package.json: every adminPages entry needs path, title, group, page and export.`);
        }
        if (!PAGE.test(page.page) || !isBinding(page.export)) {
            throw new Error(
                `${dir}/package.json: adminPages page "${page.page}" or export "${page.export}" is not usable.`,
            );
        }
        if (page.icon !== undefined && !ICON.test(page.icon)) {
            throw new Error(`${dir}/package.json: adminPages icon "${page.icon}" is not a lucide-react export name.`);
        }
        if (page.premium !== undefined && typeof page.premium !== 'boolean') {
            throw new Error(`${dir}/package.json: adminPages premium must be true or false.`);
        }
    }
    const routes = Array.isArray(meta.routes) ? meta.routes : [];
    for (const route of routes) {
        if (typeof route.path !== 'string' || !ROUTE_PATH.test(route.path)) {
            throw new Error(`${dir}/package.json: route path "${route.path}" must be a lowercase absolute path.`);
        }
        if (route.path === '/admin' || route.path.startsWith('/admin/')) {
            throw new Error(`${dir}/package.json: route "${route.path}" is an admin page; declare it in adminPages.`);
        }
        if (typeof route.page !== 'string' || !PAGE.test(route.page) || !isBinding(route.export)) {
            throw new Error(
                `${dir}/package.json: every routes entry needs path, a page under src/pages and an export name.`,
            );
        }
        if (route.access !== undefined && route.access !== 'public' && route.access !== 'protected') {
            throw new Error(`${dir}/package.json: route access must be "public" or "protected".`);
        }
        const { menu } = route;
        if (
            menu !== undefined &&
            (typeof menu?.title !== 'string' ||
                !menu.title.trim() ||
                typeof menu.icon !== 'string' ||
                !ICON.test(menu.icon))
        ) {
            throw new Error(
                `${dir}/package.json: route "${route.path}" menu needs a title and a lucide-react icon name.`,
            );
        }
    }
    const notices: Record<string, NoticeDescriptor> =
        meta.notices && typeof meta.notices === 'object' && !Array.isArray(meta.notices) ? meta.notices : {};
    for (const [code, notice] of Object.entries(notices)) {
        if (!NOTICE_CODE.test(code)) throw new Error(`${dir}/package.json: notice code "${code}" must be kebab-case.`);
        if (
            !notice ||
            !NOTICE_TYPES.has(notice.type) ||
            typeof notice.message !== 'string' ||
            !notice.message.trim() ||
            (notice.title !== undefined && typeof notice.title !== 'string') ||
            (notice.inline !== undefined && typeof notice.inline !== 'boolean')
        ) {
            throw new Error(
                `${dir}/package.json: notice "${code}" needs a type (success, info, warning, error) and a message.`,
            );
        }
    }
    const reporter = meta.errorReporter;
    if (
        reporter !== undefined &&
        (typeof reporter.import !== 'string' ||
            !/^[@.\w][\w@./-]*$/.test(reporter.import) ||
            !isBinding(reporter.export))
    ) {
        throw new Error(`${dir}/package.json: errorReporter needs an import path and an export name.`);
    }
    return {
        name,
        key: meta.key,
        factory: meta.factory,
        export: meta.export ?? `${camel(meta.key)}Package`,
        manifestImport: meta.manifestImport ?? name,
        dir,
        ...(meta.tables && Array.isArray(meta.tables.names) && meta.tables.names.length > 0
            ? { tables: { import: meta.tables.import ?? `${name}/schema`, names: meta.tables.names } }
            : {}),
        ...(adminPages.length > 0 ? { adminPages } : {}),
        ...(routes.length > 0 ? { routes } : {}),
        ...(Object.keys(notices).length > 0 ? { notices } : {}),
        ...(reporter ? { errorReporter: { import: reporter.import, export: reporter.export } } : {}),
    };
}

/** Every workspace package that carries a descriptor, by key, per monorepo root. Read once per process. */
const descriptorIndexes = new Map<string, Map<string, PackageDescriptor>>();

/**
 * The descriptor for a package KEY (`vault`, `tower`), which is usually also its folder name.
 * When it is not, every descriptor is read once and matched on `key`. Null when no package has it.
 */
export function findPackageDescriptor(root: string, key: string): PackageDescriptor | null {
    if (packageDir(root, key)) {
        try {
            const direct = readPackageDescriptor(root, key);
            if (direct.key === key) return direct;
        } catch {
            // The folder exists but has no descriptor: fall through to the index.
        }
    }
    let index = descriptorIndexes.get(root);
    if (!index) {
        index = new Map();
        for (const base of PACKAGE_ROOTS) {
            const dir = path.join(root, base);
            if (!fs.existsSync(dir)) continue;
            for (const name of fs.readdirSync(dir)) {
                if (!NAME.test(name) || !fs.existsSync(path.join(dir, name, 'package.json'))) continue;
                try {
                    const descriptor = readPackageDescriptor(root, base === 'packages' ? name : `pro/${name}`);
                    index.set(descriptor.key, descriptor);
                } catch {
                    // No descriptor, or a malformed one: not addable, so not strippable either.
                }
            }
        }
        descriptorIndexes.set(root, index);
    }
    return index.get(key) ?? null;
}

function read(file: string): string | null {
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function* walk(dir: string): Generator<string> {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(file);
        else yield file;
    }
}

/** Insert `line` after the last line matching `after`, or before the first matching `before`, else append. */
function insertLine(source: string, line: string, { after, before }: { after?: RegExp; before?: RegExp }): string {
    const eol = eolOf(source);
    const lines = source.split(/\r?\n/);
    let index = -1;
    if (after) {
        for (let i = lines.length - 1; i >= 0; i--) {
            if (after.test(lines[i])) {
                index = i + 1;
                break;
            }
        }
    }
    if (index < 0 && before) index = lines.findIndex((candidate) => before.test(candidate));
    if (index < 0) index = lines.length;
    lines.splice(index, 0, line);
    return lines.join(eol);
}

/** Merge lucide icon names into the file's `lucide-react` import, adding the import when there is none. */
function withIcons(source: string, icons: string[]): string {
    if (icons.length === 0) return source;
    const existing = source.match(/^import \{([^}]*)\} from 'lucide-react';$/m);
    const names = new Set(
        existing
            ? existing[1]
                  .split(',')
                  .map((name) => name.trim())
                  .filter(Boolean)
            : [],
    );
    for (const icon of icons) names.add(icon);
    const line = `import { ${[...names].sort().join(', ')} } from 'lucide-react';`;
    if (existing) return source.replace(existing[0], line);
    return insertLine(source, line, { after: /^import .* from '.*';$/, before: /^export const/ });
}

const quote = (value: string) =>
    `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n')}'`;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The `definePackageClient(...)` entry: bare for a headless package, with its pages otherwise. */
function clientEntry(pkg: PackageDescriptor, eol: string): string {
    if (!pkg.adminPages && !pkg.routes && !pkg.notices) return `    definePackageClient({ key: ${quote(pkg.key)} }),`;
    const pages = (pkg.adminPages ?? []).map((page) =>
        [
            '            {',
            `                path: ${quote(page.path)},`,
            `                title: ${quote(page.title)},`,
            ...(page.description ? [`                description: ${quote(page.description)},`] : []),
            ...(page.icon ? [`                icon: ${page.icon},`] : []),
            `                group: ${quote(page.group)},`,
            ...(page.scope ? [`                scope: ${quote(page.scope)},`] : []),
            ...(page.premium ? ['                premium: true,'] : []),
            `                load: () => import('@/pages/${page.page}'),`,
            `                exportName: ${quote(page.export)},`,
            '            },',
        ].join(eol),
    );
    const routes = (pkg.routes ?? []).map((route) =>
        [
            '            {',
            `                path: ${quote(route.path)},`,
            ...(route.access === 'public' ? ["                access: 'public',"] : []),
            `                load: () => import('@/pages/${route.page}'),`,
            `                exportName: ${quote(route.export)},`,
            ...(route.menu
                ? [`                menu: { title: ${quote(route.menu.title)}, icon: ${route.menu.icon} },`]
                : []),
            '            },',
        ].join(eol),
    );
    const notices = Object.entries(pkg.notices ?? {}).map(([code, notice]) =>
        [
            `            ${quote(code)}: {`,
            `                type: ${quote(notice.type)},`,
            ...(notice.title ? [`                title: ${quote(notice.title)},`] : []),
            `                message: ${quote(notice.message)},`,
            ...(notice.inline ? ['                inline: true,'] : []),
            '            },',
        ].join(eol),
    );
    return [
        '    definePackageClient({',
        `        key: ${quote(pkg.key)},`,
        ...(pages.length ? ['        adminPages: [', ...pages, '        ],'] : []),
        ...(routes.length ? ['        routes: [', ...routes, '        ],'] : []),
        ...(notices.length ? ['        notices: {', ...notices, '        },'] : []),
        '    }),',
    ].join(eol);
}

function stubComposition(pkg: PackageDescriptor): string {
    return `// ============================================================
// ${pkg.name}: generated by \`otta add\`. Review the options before shipping.
// ============================================================
// The package README (${pkg.dir}/README.md) explains each option.
// Type-check tells you what is still missing.
// ============================================================

import { ${pkg.factory} } from '${pkg.manifestImport}';

export const ${pkg.export} = ${pkg.factory}<CloudflareEnv>({
    // TODO: the options this package needs
});
`;
}

/** Work out every file change, without touching anything. */
export function planAdd(root: string, appName: string, pkg: PackageDescriptor): AddPlan {
    const appDir = path.join(root, 'apps', appName);
    if (!fs.existsSync(path.join(appDir, 'package.json'))) throw new Error(`App "${appName}" has no package.json.`);
    const steps: AddStep[] = [];
    const rel = (file: string) => path.relative(root, file).split(path.sep).join('/');
    const shippedDir = path.join(root, pkg.dir, 'app');
    const compositionRel = `ottabase/packages/${pkg.key}.ts`;

    // 1. The dependency.
    const pkgJsonFile = path.join(appDir, 'package.json');
    const appPkg = fs.readJsonSync(pkgJsonFile) as { dependencies?: Record<string, string> };
    if (appPkg.dependencies?.[pkg.name]) {
        steps.push({ file: rel(pkgJsonFile), action: 'skip', detail: `${pkg.name} already a dependency` });
    } else {
        const raw = fs.readFileSync(pkgJsonFile, 'utf8');
        const eol = eolOf(raw);
        const updated = { ...appPkg, dependencies: { ...(appPkg.dependencies ?? {}), [pkg.name]: 'workspace:*' } };
        steps.push({
            file: rel(pkgJsonFile),
            action: 'edit',
            detail: `add ${pkg.name}: workspace:*`,
            content: JSON.stringify(updated, null, 4).replace(/\n/g, eol) + eol,
        });
    }

    // 2. The composition: shipped with the package, else the reference app's, else a stub.
    const compositionFile = path.join(appDir, compositionRel);
    if (fs.existsSync(compositionFile)) {
        steps.push({ file: rel(compositionFile), action: 'skip', detail: 'composition exists' });
    } else {
        const shipped = read(path.join(shippedDir, compositionRel));
        const reference =
            shipped ??
            (appName === REFERENCE_APP ? null : read(path.join(root, 'apps', REFERENCE_APP, compositionRel)));
        steps.push({
            file: rel(compositionFile),
            action: 'create',
            detail: shipped
                ? `copied from ${pkg.dir}/app`
                : reference
                  ? `copied from apps/${REFERENCE_APP}`
                  : 'stub; fill in the options',
            content: reference ?? stubComposition(pkg),
        });
    }

    // 3. The one list.
    const listFile = path.join(appDir, 'ottabase', 'packages.ts');
    const list = read(listFile);
    if (list === null) {
        steps.push({ file: rel(listFile), action: 'skip', detail: 'no ottabase/packages.ts (not a package-list app)' });
    } else if (list.includes(`./packages/${pkg.key}'`)) {
        steps.push({ file: rel(listFile), action: 'skip', detail: 'already listed' });
    } else {
        let updated = insertLine(list, `import { ${pkg.export} } from './packages/${pkg.key}';`, {
            after: /^import .* from '\.\/packages\/[a-z0-9-]+';$/,
        });
        updated = insertLine(updated, `    ${pkg.export},`, { before: /^\s*\/\/ Premium|^\]\);$/ });
        steps.push({ file: rel(listFile), action: 'edit', detail: `list ${pkg.export}`, content: updated });
    }

    // 4. The client mirror: the key, plus the pages the package declares. The router and the menus read them there.
    const clientFile = path.join(appDir, 'src', 'ottabase', 'config', 'packages.ts');
    const client = read(clientFile);
    if (client === null) {
        steps.push({ file: rel(clientFile), action: 'skip', detail: 'no client package list' });
    } else if (new RegExp(`key:\\s*'${pkg.key}'`).test(client)) {
        steps.push({ file: rel(clientFile), action: 'skip', detail: 'client key present' });
    } else {
        const icons = [
            ...(pkg.adminPages ?? []).map((page) => page.icon),
            ...(pkg.routes ?? []).map((route) => route.menu?.icon),
        ].filter((icon): icon is string => !!icon);
        const updated = withIcons(
            insertLine(client, clientEntry(pkg, eolOf(client)), {
                after: /^\s*definePackageClient\(\{ key: '[a-z0-9-]+' \}\),$/,
                before: /^\];$/,
            }),
            icons,
        );
        const counts = [
            pkg.adminPages?.length ? `${pkg.adminPages.length} admin page(s)` : '',
            pkg.routes?.length ? `${pkg.routes.length} route(s)` : '',
        ].filter(Boolean);
        const pages = counts.length ? ` with ${counts.join(' and ')}` : '';
        steps.push({
            file: rel(clientFile),
            action: 'edit',
            detail: `client key '${pkg.key}'${pages}`,
            content: updated,
        });
    }

    // 5. Tables for drizzle-kit.
    if (pkg.tables) {
        const schemaFile = path.join(appDir, 'ottabase', 'db', 'schema.ts');
        const schema = read(schemaFile);
        const line = `export { ${pkg.tables.names.join(', ')} } from '${pkg.tables.import}';`;
        if (schema === null) {
            steps.push({ file: rel(schemaFile), action: 'skip', detail: 'no ottabase/db/schema.ts' });
        } else if (schema.includes(`from '${pkg.tables.import}'`)) {
            steps.push({ file: rel(schemaFile), action: 'skip', detail: 'tables re-exported' });
        } else {
            const updated = insertLine(schema, line, {
                after: /^export \{ .* \} from '@ottabase\/[a-z0-9-]+\/[a-z-]+';$/,
            });
            steps.push({
                file: rel(schemaFile),
                action: 'edit',
                detail: `re-export ${pkg.tables.names.join(', ')}`,
                content: updated,
            });
        }
    }

    // 6. Everything else the package ships for the app (pages, …), copied where the app has no file yet.
    if (fs.existsSync(shippedDir)) {
        for (const file of walk(shippedDir)) {
            const relative = path.relative(shippedDir, file).split(path.sep).join('/');
            if (relative === compositionRel) continue;
            const target = path.join(appDir, relative);
            steps.push(
                fs.existsSync(target)
                    ? { file: rel(target), action: 'skip', detail: 'exists' }
                    : {
                          file: rel(target),
                          action: 'create',
                          detail: `copied from ${pkg.dir}/app`,
                          content: fs.readFileSync(file, 'utf8'),
                      },
            );
        }
    }

    // 6b. A public package ships no app/ folder: its pages live in the reference app, listed in that
    // app's footprint map (what `otta strip` removes). Copied where this app has no such file. What
    // the reference app wires by hand around them (a route, a nav entry) is marked `otta:only <key>`
    // there and is not copied: the plan says so.
    if (appName !== REFERENCE_APP && !fs.existsSync(shippedDir)) {
        const referenceDir = path.join(root, 'apps', REFERENCE_APP);
        const footprint = fs.existsSync(referenceDir) ? readFootprints(referenceDir)[pkg.key] : undefined;
        let copied = 0;
        for (const p of footprint?.paths ?? []) {
            const source = path.join(referenceDir, p);
            if (!fs.existsSync(source)) continue;
            for (const file of fs.statSync(source).isDirectory() ? walk(source) : [source]) {
                const target = path.join(appDir, path.relative(referenceDir, file));
                if (fs.existsSync(target)) {
                    steps.push({ file: rel(target), action: 'skip', detail: 'exists' });
                    continue;
                }
                copied++;
                steps.push({
                    file: rel(target),
                    action: 'create',
                    detail: `copied from apps/${REFERENCE_APP}`,
                    content: fs.readFileSync(file, 'utf8'),
                });
            }
        }
        if (copied > 0) {
            steps.push({
                file: `apps/${REFERENCE_APP}`,
                action: 'skip',
                detail: `lines marked "otta:only ${pkg.key}" there (routes, nav) are not copied: carry them by hand`,
            });
        }
    }

    // 7. Render errors the root error boundary catches, handed to the package.
    if (pkg.errorReporter) {
        const mainFile = path.join(appDir, 'src', 'main.tsx');
        const main = read(mainFile);
        const { import: from, export: reporter } = pkg.errorReporter;
        // The import and the wiring are checked apart: a half-done manual setup has one without the other.
        const name = escapeRegex(reporter);
        const imported = new RegExp(`^import\\s*\\{[^}]*(?<![\\w$])${name}(?![\\w$])[^}]*\\}\\s*from`, 'm').test(
            main ?? '',
        );
        const wired = new RegExp(`<ErrorBoundary\\s+onError=\\{[^}]*(?<![\\w$])${name}\\(`).test(main ?? '');
        if (wired) {
            steps.push({ file: rel(mainFile), action: 'skip', detail: `error boundary reports to ${reporter}` });
        } else if (main === null || !main.includes('<ErrorBoundary>')) {
            steps.push({
                file: rel(mainFile),
                action: 'skip',
                detail: `no bare <ErrorBoundary>; pass ${reporter} to its onError by hand`,
            });
        } else {
            const line = `import { ${reporter} } from ${quote(from)};`;
            const withImport = imported
                ? main
                : /^import \{ ErrorBoundary \} from .*;\r?$/m.test(main)
                  ? insertLine(main, line, { after: /^import \{ ErrorBoundary \} from .*;$/ })
                  : insertLine(main, line, { after: /^import .* from '.*';$/ });
            steps.push({
                file: rel(mainFile),
                action: 'edit',
                detail: `root <ErrorBoundary> reports to ${reporter}`,
                content: withImport
                    .split('<ErrorBoundary>')
                    .join(`<ErrorBoundary onError={(error) => ${reporter}(error)}>`),
            });
        }
    }

    return { app: appName, appDir, package: pkg, steps };
}

export function applyAdd(root: string, plan: AddPlan): void {
    for (const step of plan.steps) {
        if (step.action === 'skip' || step.content === undefined) continue;
        const file = path.join(root, step.file);
        fs.ensureDirSync(path.dirname(file));
        fs.writeFileSync(file, step.content);
    }
}

export function formatAddPlan(plan: AddPlan): string {
    const lines = [`Add ${plan.package.name} (key "${plan.package.key}") to ${plan.app}:`];
    for (const step of plan.steps) lines.push(`  ${step.action.padEnd(6)} ${step.file}  ${step.detail}`);
    return lines.join('\n');
}

/**
 * Plan and apply one package after another: each plan reads the files the previous one wrote, so
 * two packages that edit the same list both land. A dry run plans every package against the
 * untouched app, which is what "what would change" means.
 */
export function addPackages(
    root: string,
    appName: string,
    descriptors: PackageDescriptor[],
    options: { dryRun?: boolean; report?: (plan: AddPlan) => void } = {},
): AddPlan[] {
    const plans: AddPlan[] = [];
    for (const pkg of descriptors) {
        const plan = planAdd(root, appName, pkg);
        options.report?.(plan);
        if (!options.dryRun) applyAdd(root, plan);
        plans.push(plan);
    }
    return plans;
}

/** `otta add <package|bundle> [app]`: list a workspace package (or every package of a bundle) in an app. */
export async function addPackage(
    requested: string,
    appName?: string,
    options: { dryRun?: boolean } = {},
): Promise<AddPlan[]> {
    const root = getMonorepoRoot();
    const app = resolveApp(appName);
    const members = listBundle(root, requested);
    const descriptors = (members ?? [requested]).map((name) => readPackageDescriptor(root, name));
    if (members) log.dim(`${requested} is a bundle: ${descriptors.map((pkg) => pkg.name).join(', ')}\n`);
    const plans = addPackages(root, app.name, descriptors, {
        dryRun: options.dryRun,
        report: (plan) => console.log(formatAddPlan(plan)),
    });
    if (options.dryRun) {
        log.dim('\nDry run: nothing written.');
        return plans;
    }
    const steps = plans.flatMap((plan) => plan.steps);
    const what = descriptors.map((pkg) => pkg.name).join(', ');
    // The exit words of the design system: Done. (green) then Next: (amber) with the fix.
    console.log('');
    if (!steps.some((step) => step.action !== 'skip')) {
        log.done(`${what} already wired into ${app.name}.`);
        return plans;
    }
    log.done(`${what} added to ${app.name}.`);
    log.next('');
    const next = ['pnpm install', 'pnpm build:pkg'];
    const compositions = steps.filter((step) => step.action === 'create' && step.file.includes('/ottabase/packages/'));
    if (compositions.length) next.push(`Review ${compositions.map((step) => step.file).join(', ')}`);
    next.push(`Read ${descriptors.map((pkg) => `${pkg.dir}/README.md`).join(' and ')}: the secrets are yours`);
    next.push(`otta type-check ${app.name} && otta test ${app.name}`);
    next.forEach((step, index) => log.dim(`  ${index + 1}. ${step}`));
    return plans;
}
