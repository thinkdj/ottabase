// ============================================================
// @ottabase/kernel/client — the browser half of a package
// ============================================================
// A server manifest carries session resolution and route factories, which have no
// place in a browser bundle. So a package with rendered admin pages ALSO ships a small
// client descriptor: its key and its pages. The app lists those in one array next to
// the server list, and a parity test keeps the two honest.
// ============================================================

import type { ComponentType } from 'react';

export interface AdminPageContribution {
    /** Route path, e.g. `/admin/growth/webhooks`. */
    path: string;
    title: string;
    description: string;
    /** Icon component (lucide or tabler). */
    icon: ComponentType<{ className?: string; size?: number | string }>;
    /** `org` = own-tenant admins may see it; `platform` (default) = platform admins only. */
    scope?: 'platform' | 'org';
    /** Admin nav group id the page lives under (e.g. `growth`). */
    group: string;
    /** A Premium Package's page: the nav entry carries a lock, and stays listed when the license lapses. */
    premium?: boolean;
    /** Lazy import of the page module; the named export `exportName` is rendered. */
    load: () => Promise<Record<string, ComponentType>>;
    exportName: string;
}

export interface OttaPackageClient {
    /** The same key as the server manifest. */
    key: string;
    adminPages?: AdminPageContribution[];
}

const PACKAGE_KEY_RE = /^[a-z][a-z0-9-]{1,48}$/;

/** Validate a client descriptor at definition time. A checked identity function. */
export function definePackageClient(client: OttaPackageClient): OttaPackageClient {
    if (!PACKAGE_KEY_RE.test(client.key)) {
        throw new Error(`[kernel/client] Invalid package key "${client.key}".`);
    }
    for (const page of client.adminPages ?? []) {
        if (!page.path.startsWith('/admin/')) {
            throw new Error(
                `[kernel/client] Package "${client.key}" admin page path must start with "/admin/" (got "${page.path}").`,
            );
        }
        if (!page.group?.trim()) {
            throw new Error(`[kernel/client] Package "${client.key}" admin page "${page.path}" needs a nav group.`);
        }
        if (!page.exportName?.trim() || typeof page.load !== 'function') {
            throw new Error(
                `[kernel/client] Package "${client.key}" admin page "${page.path}" needs load() and exportName.`,
            );
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
