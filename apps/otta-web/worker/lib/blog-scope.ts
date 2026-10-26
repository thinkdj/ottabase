// ---------------------------------------------------------------------------
// The blog an HTML document belongs to, for the edge injectors (SEO, theme).
// /blog is the site blog; /blogs/{orgSlug} an organization's blog, served only
// with features.ottablog.orgBlogs. Same rules as the public blog API's `?blog=`.
// ---------------------------------------------------------------------------

import type { BlogScope } from '@ottabase/ottablog';
import { parseBlogPath } from '@ottabase/ottablog/paths';
import { Organization } from '@ottabase/ottaorm';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { ensureDbConnection } from './db-utils';

export interface DocumentBlog {
    scope: BlogScope;
    /** The organization's slug, or null for the site blog. */
    blogSlug: string | null;
}

async function resolve(request: Request, env: CloudflareEnv): Promise<DocumentBlog | null> {
    const parsed = parseBlogPath(new URL(request.url).pathname);
    if (!parsed) return null;
    const config = getOttabaseConfig(env);
    if (parsed.blogSlug === null) {
        return { scope: { appId: config.appId, organizationId: null }, blogSlug: null };
    }
    if (!config.features.ottablog.orgBlogs || !env.OBCF_D1) return null;
    ensureDbConnection(env);
    const org = await Organization.findBySlug(parsed.blogSlug);
    if (!org || (org.status ?? 'active') !== 'active') return null;
    return { scope: { appId: config.appId, organizationId: org.id }, blogSlug: org.slug };
}

/**
 * The blog of this document request, or null outside every blog (or for an unknown, inactive or
 * disabled organization blog). Memoized per Request: the SEO and theme injectors ask on the same
 * navigation, and the organization lookup is a D1 read.
 */
const byRequest = new WeakMap<Request, Promise<DocumentBlog | null>>();
export function blogForDocument(request: Request, env: CloudflareEnv): Promise<DocumentBlog | null> {
    let blog = byRequest.get(request);
    if (!blog) byRequest.set(request, (blog = resolve(request, env).catch(() => null)));
    return blog;
}
