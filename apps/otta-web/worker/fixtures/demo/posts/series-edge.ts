/**
 * "Building on the edge": four engineering articles that read in order. The series is the spine of
 * the demo blog, so it carries the richest blocks: tables, code, steps, warnings and a checklist.
 */
import type { BlogDemoPostSeed } from '@ottabase/ottablog/router';
import { checklist, code, cta, doc, h2, ol, p, quote, steps, table, ul, warning } from '../blocks';
import { IMAGES, unsplash } from '../images';
import { TOMAS } from '../people';

const SERIES = {
    title: 'Building on the edge',
    description:
        'What changes when the database, the files and the code all live a few milliseconds from the reader. Four parts, in order.',
    coverImage: { url: unsplash(IMAGES.earth), alt: IMAGES.earth.alt },
};

type Article = Extract<BlogDemoPostSeed, { content: unknown }>;

const part = (
    order: number,
    seed: Omit<Article, 'contentType' | 'series' | 'categories' | 'authorEmail'>,
): Article => ({
    ...seed,
    contentType: 'blog',
    series: { ...SERIES, order },
    categories: ['Engineering'],
    authorEmail: TOMAS,
});

export const EDGE_SERIES: readonly BlogDemoPostSeed[] = [
    part(1, {
        title: 'Why we build on the edge',
        slug: 'why-we-build-on-the-edge',
        excerpt:
            'Every request has a home. Ours is wherever the reader is. The case for running the whole app, database included, on Cloudflare.',
        isFeatured: true,
        publishedAt: '2026-04-14T08:30:00.000Z',
        heroImage: { url: unsplash(IMAGES.earthNight), alt: IMAGES.earthNight.alt, caption: IMAGES.earthNight.caption },
        tags: ['Cloudflare', 'Workers', 'Performance', 'Architecture'],
        seoMeta: {
            title: 'Why we build on the edge',
            description: 'The case for running a whole app, database included, on Cloudflare Workers, D1 and R2.',
        },
        content: doc('why-we-build-on-the-edge', [
            p(
                'Every request has a home. For most web apps that home is a region: a cluster in Virginia or Frankfurt that every reader on the planet has to travel to. The app feels fast to the people who happen to live near it and slow to everyone else, and the team that built it rarely notices, because they live near it too.',
            ),
            p(
                'We wanted the other thing. An app whose home is wherever the reader is, where the code, the database and the files are all a few milliseconds away. This series is about what that choice costs, what it buys, and how the pieces fit.',
            ),
            h2('Latency is a product decision'),
            p(
                'A page that renders in 40 ms on the server still feels slow when the server is 180 ms away. Round trips add up quietly: the HTML, the session check, two API calls, an image. Here is what a single round trip looks like from a few places to a single region in Frankfurt, measured on an ordinary afternoon.',
            ),
            table([
                ['Reader in', 'Round trip to Frankfurt', 'Round trip to the nearest edge'],
                ['Lisbon', '38 ms', '6 ms'],
                ['Toronto', '104 ms', '9 ms'],
                ['São Paulo', '211 ms', '11 ms'],
                ['Singapore', '172 ms', '7 ms'],
                ['Sydney', '286 ms', '14 ms'],
            ]),
            p(
                'Multiply the first column by the five or six trips a normal page makes and you have the difference between an app that feels native and one that feels remote. No amount of server tuning closes that gap. Moving the server does.',
            ),
            h2('What the edge actually gives you'),
            ul([
                '<b>Workers</b> start in under a millisecond, in every city Cloudflare has a presence in, with no instance to keep warm and no region to pick.',
                '<b>D1</b> puts a real SQL database next to the Worker. Reads are local; writes go to the primary and come back fast enough that you stop thinking about it.',
                '<b>R2</b> stores files without egress fees, which matters the moment a media library gets popular.',
                '<b>KV</b> holds the things that change rarely and are read constantly: brand settings, feature flags, the resolved navigation.',
                '<b>Queues</b> take the slow work off the request path, so sending an email never makes a page wait.',
            ]),
            p('A complete request handler, with a database query, is short enough to read in one breath:'),
            code(
                "export default {\n    async fetch(request: Request, env: Env): Promise<Response> {\n        const url = new URL(request.url);\n        const slug = url.pathname.replace('/blog/', '');\n        const post = await env.OBCF_D1.prepare(\n            'SELECT title, excerpt FROM posts WHERE slug = ? AND status = ?',\n        )\n            .bind(slug, 'published')\n            .first();\n        if (!post) return new Response('Not found', { status: 404 });\n        return Response.json(post, { headers: { 'cache-control': 'public, max-age=60' } });\n    },\n};",
            ),
            h2('What it costs you'),
            p(
                'Honesty about the trade: there is no long-running process, so anything that needs to stay in memory between requests needs a Durable Object or a cache. D1 is SQLite, which is a gift for most apps and a surprise for people expecting Postgres features. And caching needs a different mental model, because the cache is also distributed, which is the subject of part three.',
            ),
            quote(
                'We did not move to the edge to be clever. We moved because the slowest reader is the one who decides whether the app feels finished.',
                'From the internal design note that started this',
            ),
            h2('Where this series goes'),
            ol([
                'Why we build on the edge, which you are reading.',
                'One database per tenant was the wrong question: how tenants stay apart inside one D1.',
                'Caching that respects tenants: keys, invalidation and the things we refuse to cache.',
                'Shipping migrations without a maintenance window: models as the schema, and seeds as migrations.',
            ]),
            cta('Read the docs', '/docs'),
        ]),
    }),
    part(2, {
        title: 'One database per tenant was the wrong question',
        slug: 'one-database-per-tenant-was-the-wrong-question',
        excerpt:
            'Multi-tenancy is usually argued as a deployment choice. It is a data choice: every row knows who it belongs to, and the database refuses to forget.',
        publishedAt: '2026-05-05T09:00:00.000Z',
        heroImage: { url: unsplash(IMAGES.serverRacks), alt: IMAGES.serverRacks.alt },
        tags: ['D1', 'Multi-tenancy', 'Security'],
        seoMeta: {
            description: 'How tenants stay apart inside one database, with row-level security the app cannot skip.',
        },
        content: doc('one-database-per-tenant-was-the-wrong-question', [
            p(
                'The multi-tenancy argument usually starts with deployment: one database for everyone, or one per customer? We spent a week on that question before noticing it was the wrong one. The real question is simpler and harder. When a row is read, who is allowed to see it, and what stops the app from forgetting to ask?',
            ),
            h2('Rows know who they belong to'),
            p(
                'Every table that holds tenant data carries an <code>organization_id</code>. Every read goes through a security context that was resolved from the session on the server, never from the request. The model layer adds the tenant filter itself, so a handler cannot leave it out by accident.',
            ),
            code(
                "const context = await resolveSecurityContext(request, env);\n// { userId: 'usr_8f3a', organizationId: 'org_42', permissions: ['posts:read', ...] }\n\n// The filter is added by the model, not by the caller\nconst posts = await Post.where({ status: 'published' }, { context });\n// SELECT * FROM posts WHERE status = ? AND organization_id = ?\n\n// A write outside the caller's organization is refused before it reaches D1\nawait Post.create({ title, organizationId: 'org_99' }, { context }); // RLSError",
            ),
            h2('The three mistakes we made first'),
            ol([
                'Trusting an <code>x-org-id</code> header. Headers are requests, and requests are written by whoever is sending them.',
                'Filtering in the handler. It worked until the fourth handler, written on a Friday, did not.',
                'Caching a resolved page under a key that did not include the tenant. Part three is about that one.',
            ]),
            warning(
                'Membership is the boundary',
                'An organization without an owner membership is unreachable, even by the person who created it. Provisioning creates the organization and the membership in one step, and rolls both back if either fails.',
            ),
            h2('What it looks like in practice'),
            table([
                ['Operation', 'Scope it runs in', 'Who may run it'],
                ['Read published posts', 'The organization the site belongs to', 'Anyone'],
                ['Edit a draft', 'The post row\u2019s organization', 'Its author, an editor, an org admin'],
                ['Change a role', 'The organization the role is granted in', 'An org admin'],
                [
                    'Read the audit log',
                    'Organizations the caller is a member of',
                    'Admins, for their own organizations',
                ],
            ]),
            p(
                'The pattern is boring on purpose. A new table gets a tenant column and a model; the model gets the same filter as every other model; the handler gets to be short. The interesting work moved out of the handlers and into one place that is tested once.',
            ),
        ]),
    }),
    part(3, {
        title: 'Caching that respects tenants',
        slug: 'caching-that-respects-tenants',
        excerpt:
            'A cache is the easiest place to leak data between customers. Put the tenant in the key, invalidate on write, and know what you will never cache.',
        publishedAt: '2026-05-26T07:45:00.000Z',
        heroImage: { url: unsplash(IMAGES.circuit), alt: IMAGES.circuit.alt },
        tags: ['Caching', 'KV', 'Performance', 'Multi-tenancy'],
        content: doc('caching-that-respects-tenants', [
            p(
                'Here is the uncomfortable truth about caching in a multi-tenant app: it is the single easiest way to show one customer another customer\u2019s data. Not through a clever attack. Through a key that was one segment too short.',
            ),
            h2('Put the tenant in the key'),
            p(
                'Every cache key that can hold tenant data starts with the tenant. Not ends, starts, so that listing keys by prefix gives you exactly one tenant\u2019s entries and nothing else. The app id comes next, then the thing.',
            ),
            code(
                "export const cacheKey = (scope: { appId: string; organizationId: string | null }, ...parts: string[]) =>\n    ['org', scope.organizationId ?? 'platform', 'app', scope.appId, ...parts].join(':');\n\n// org:org_42:app:otta-web:brand:full\n// org:platform:app:otta-web:menu:header-nav",
            ),
            h2('Invalidate on write, warm on read'),
            steps([
                ['Write to D1 first', 'The database is the truth. Nothing is cached that was not written.'],
                [
                    'Invalidate the keys the write touched',
                    'A brand kit save clears that kit\u2019s keys and the resolved config of every app that uses it.',
                ],
                [
                    'Re-resolve immediately',
                    'The next reader should not pay for the miss, so the write path warms the cache before it returns.',
                ],
                [
                    'Skip the cache on the warm-up read',
                    'KV is eventually consistent. Reading it right after a delete can return the stale value you just removed.',
                ],
            ]),
            h2('What we do not cache'),
            ul([
                'Anything resolved from a session: permissions, memberships, the active organization.',
                'Drafts. A preview link is signed and served fresh, every time.',
                'Search results that depend on who is asking.',
                'Audit rows, because an audit log that lies is worse than none.',
            ]),
            checklist([
                ['The key starts with the tenant', true],
                ['The write path invalidates every key it affects', true],
                ['The value contains nothing resolved from a session', true],
                ['A stale read would be embarrassing, not dangerous', true],
            ]),
            p('If any box above is unticked, the thing does not go in the cache. We have never regretted that rule.'),
        ]),
    }),
    part(4, {
        title: 'Shipping migrations without a maintenance window',
        slug: 'shipping-migrations-without-a-maintenance-window',
        excerpt:
            'Models are the schema. The migration engine adds what is missing, refuses what would lose data, and treats seeds as migrations with a name.',
        publishedAt: '2026-06-16T10:15:00.000Z',
        heroImage: { url: unsplash(IMAGES.bridgeSunset), alt: IMAGES.bridgeSunset.alt },
        tags: ['D1', 'Migrations', 'Workflow'],
        content: doc('shipping-migrations-without-a-maintenance-window', [
            p(
                'Schema changes on a live app used to mean a window: a Tuesday night, a banner, someone on call. On the edge there is no single server to take down, so there is no window to open. The schema has to move while the app keeps answering.',
            ),
            h2('Models are the schema'),
            p(
                'We do not write <code>CREATE TABLE</code> by hand. A model declares its table and its fields, and the migration engine compares that declaration with the database and adds what is missing. A new column is one line in a model, deployed with the code that reads it.',
            ),
            code(
                "export class Shortlink extends BaseModel {\n    static entity = 'shortlinks';\n    static table = shortlinksTable;\n    static writable = {\n        create: ['fullUrl', 'shortCode', 'type', 'expiryDate'],\n        update: ['fullUrl', 'shortCode', 'type', 'expiryDate'],\n    };\n}",
            ),
            h2('What runs automatically, and what does not'),
            table([
                ['Change', 'Automatic', 'Why'],
                ['New table', 'Yes', 'Nothing to lose'],
                ['New column with a default', 'Yes', 'Existing rows can be backfilled'],
                ['New NOT NULL column without a default', 'No', 'Existing rows would be invalid'],
                ['Rename or drop', 'No', 'Data would be lost; needs an explicit opt-in'],
                ['Index', 'Yes', 'Declared on the model, ensured on init'],
            ]),
            h2('The order of operations'),
            steps([
                ['Deploy code that tolerates both shapes', 'The new column is optional in the reader for one release.'],
                ['Run init', 'Tables and columns are added. History is recorded, so running it twice is a no-op.'],
                ['Backfill if you must', 'A named custom migration, run once, recorded like any other.'],
                ['Deploy code that requires the new shape', 'Now the column can be relied on.'],
            ]),
            warning(
                'A new NOT NULL column needs a default',
                'Without one the engine stops rather than guess. Add the default, or make the column nullable and tighten it later.',
            ),
            h2('Seeding is a migration too'),
            p(
                'Demo content, default roles and the first brand kit all arrive through the same door: a named step that runs once and leaves a record. The seed that filled this very blog is create-only, keyed on slugs, emails and short codes, so running it again after an editor has changed things touches nothing.',
            ),
        ]),
    }),
];
