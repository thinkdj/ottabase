// ============================================================
// @ottabase/kernel/client — the browser half of a package
// ============================================================
// A server manifest carries session resolution and route factories, which have no
// place in a browser bundle. So a package that renders pages ALSO ships a small client
// descriptor: its key, its admin pages and its other pages. The app lists those in one
// array next to the server list, and a parity test keeps the two honest. The router
// mounts the pages and the account menu links the ones that ask for it, so installing a
// package touches that one array.
// ============================================================

import type { ComponentType } from 'react';

/** A lucide or tabler icon component. */
export type PackageIcon = ComponentType<{ className?: string; size?: number | string }>;

/** A lazy page module; the named export `exportName` is rendered. */
type PageLoader = () => Promise<Record<string, ComponentType>>;

export interface AdminPageContribution {
    /** Route path, e.g. `/admin/growth/webhooks`. */
    path: string;
    title: string;
    description: string;
    icon: PackageIcon;
    /** `org` = own-tenant admins may see it; `platform` (default) = platform admins only. */
    scope?: 'platform' | 'org';
    /** Admin nav group id the page lives under (e.g. `growth`). */
    group: string;
    /** A Premium Package's page: the nav entry carries a lock, and stays listed when the license lapses. */
    premium?: boolean;
    load: PageLoader;
    exportName: string;
}

/** A page outside `/admin`: a signed-in page such as `/billing`, or a public one such as `/status`. */
export interface PageRouteContribution {
    path: string;
    /** `protected` (the default) needs a session; `public` does not. */
    access?: 'public' | 'protected';
    load: PageLoader;
    exportName: string;
    /** A link to the page in the signed-in account menu. */
    menu?: { title: string; icon: PackageIcon };
}

/**
 * A message the app shows when a URL arrives with `?notice=<code>` (after a redirect). Codes,
 * never text, travel in the URL; the message lives here. `inline` means a page claims the code
 * and renders it itself (with `useNotice`) instead of a toast.
 */
export interface NoticeContribution {
    type: 'success' | 'info' | 'warning' | 'error';
    title?: string;
    message: string;
    inline?: boolean;
}

export interface OttaPackageClient {
    /** The same key as the server manifest. */
    key: string;
    adminPages?: AdminPageContribution[];
    routes?: PageRouteContribution[];
    /** URL notices this package may redirect with, keyed by a kebab-case code (namespaced as `key.code`). */
    notices?: Record<string, NoticeContribution>;
}

const PACKAGE_KEY_RE = /^[a-z][a-z0-9-]{1,48}$/;
const ROUTE_PATH_RE = /^\/[a-z0-9/_-]*$/;
const NOTICE_CODE_RE = /^[a-z][a-z0-9-]*$/;

/** Validate a client descriptor at definition time. A checked identity function. */
export function definePackageClient(client: OttaPackageClient): OttaPackageClient {
    if (!PACKAGE_KEY_RE.test(client.key)) {
        throw new Error(`[kernel/client] Invalid package key "${client.key}".`);
    }
    const fail = (message: string): never => {
        throw new Error(`[kernel/client] Package "${client.key}" ${message}.`);
    };
    for (const page of client.adminPages ?? []) {
        if (!page.path.startsWith('/admin/')) fail(`admin page path must start with "/admin/" (got "${page.path}")`);
        if (!page.group?.trim()) fail(`admin page "${page.path}" needs a nav group`);
        if (!page.exportName?.trim() || typeof page.load !== 'function') {
            fail(`admin page "${page.path}" needs load() and exportName`);
        }
    }
    for (const code of Object.keys(client.notices ?? {})) {
        if (!NOTICE_CODE_RE.test(code)) fail(`notice code "${code}" must be kebab-case`);
    }
    for (const route of client.routes ?? []) {
        if (!ROUTE_PATH_RE.test(route.path) || route.path === '/admin' || route.path.startsWith('/admin/')) {
            fail(`route "${route.path}" must be a lowercase path outside /admin (admin pages go in adminPages)`);
        }
        if (!route.exportName?.trim() || typeof route.load !== 'function') {
            fail(`route "${route.path}" needs load() and exportName`);
        }
        if (route.menu && (!route.menu.title?.trim() || !route.menu.icon)) {
            fail(`route "${route.path}" menu needs a title and an icon`);
        }
    }
    return client;
}

/** `{ [key]: true }` for every listed package: the browser's answer to `registry.installed()`. */
export function installedPackages(clients: ReadonlyArray<OttaPackageClient>): Record<string, boolean> {
    return Object.fromEntries(clients.map((client) => [client.key, true]));
}

/** Every admin page across the listed packages, tagged with its package key. */
export function packageAdminPages(
    clients: ReadonlyArray<OttaPackageClient>,
): Array<AdminPageContribution & { pkg: string }> {
    return clients.flatMap((client) => (client.adminPages ?? []).map((page) => ({ ...page, pkg: client.key })));
}

/** Every URL notice across the listed packages, namespaced `key.code` so two packages never collide. */
export function packageNotices(clients: ReadonlyArray<OttaPackageClient>): Record<string, NoticeContribution> {
    const out: Record<string, NoticeContribution> = {};
    for (const client of clients) {
        for (const [code, notice] of Object.entries(client.notices ?? {})) out[`${client.key}.${code}`] = notice;
    }
    return out;
}

/** Every other page across the listed packages, tagged with its package key. Two packages may not share a path. */
export function packageRoutes(
    clients: ReadonlyArray<OttaPackageClient>,
): Array<PageRouteContribution & { pkg: string }> {
    const routes = clients.flatMap((client) => (client.routes ?? []).map((route) => ({ ...route, pkg: client.key })));
    const owner = new Map<string, string>();
    for (const route of routes) {
        const other = owner.get(route.path);
        if (other) throw new Error(`[kernel/client] "${other}" and "${route.pkg}" both route ${route.path}.`);
        owner.set(route.path, route.pkg);
    }
    return routes;
}

// ── URL notice hand-off ─────────────────────────────────────
// The app's root handler strips `?notice=<code>` on its first effect. On a cold load that runs
// before a lazily loaded page has rendered, so a page that shows its notice inline (a login
// error, a checkout return) could never read it from the URL. The handler parks every code it
// does not toast; the page claims it. Packages use this too, since they cannot import the app.

let parkedNotice: { code: string; pathname: string } | null = null;

/** The root handler parks a notice for the page at `pathname`. */
export function parkNotice(code: string, pathname: string): void {
    parkedNotice = { code, pathname };
}

/**
 * Claim this page's notice: from the URL when it is still there, else the one parked for this
 * path. `accept` says which codes the page owns (`(code) => code.startsWith('sso.')`). A parked
 * notice is handed out once.
 */
export function claimNotice(
    accept: (code: string) => boolean,
    location: { pathname: string; search: string } | undefined = typeof window === 'undefined'
        ? undefined
        : window.location,
): string | null {
    if (!location) return null;
    const fromUrl = new URLSearchParams(location.search).get('notice');
    if (fromUrl && accept(fromUrl)) return fromUrl;
    const parked = parkedNotice;
    if (!parked || parked.pathname !== location.pathname || !accept(parked.code)) return null;
    parkedNotice = null;
    return parked.code;
}
