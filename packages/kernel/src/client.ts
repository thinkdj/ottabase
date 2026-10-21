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

export interface OttaPackageClient {
    /** The same key as the server manifest. */
    key: string;
    adminPages?: AdminPageContribution[];
    routes?: PageRouteContribution[];
}

const PACKAGE_KEY_RE = /^[a-z][a-z0-9-]{1,48}$/;
const ROUTE_PATH_RE = /^\/[a-z0-9/_-]*$/;

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
