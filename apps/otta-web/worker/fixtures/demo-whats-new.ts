import type { BlogDemoPostSeed } from '@ottabase/ottablog/router';
import { checklist, code, doc, h, on, p, table, ul, warning } from './demo-blocks';

/**
 * The demo's "What's new" timeline: real Ottabase release notes, dated by the commits that
 * shipped them. Highlighted entries carry screenshots served from `public/ottabase-demo/`, so
 * they resolve on any deployment without uploads.
 */

const REPO = 'https://github.com/thinkdj/ottabase';

const cta = (text: string, url: string) => ({
    type: 'cta',
    data: { text, url, style: 'secondary', alignment: 'left', openInNewTab: true, icon: '' },
});

/** A release note. Everything here is `changelog` and tagged by area. */
const release = (seed: Omit<BlogDemoPostSeed, 'contentType' | 'publishedAt'> & { date: string }): BlogDemoPostSeed => {
    const { date, ...rest } = seed;
    return { ...rest, contentType: 'changelog', publishedAt: on(date), categories: ['Release notes'] };
};

export const demoWhatsNewPosts: readonly BlogDemoPostSeed[] = [
    release({
        date: '2026-10-20',
        title: 'Ottabase Pro: seven packages, sold as source',
        slug: 'ottabase-pro-launch',
        isFeatured: true,
        excerpt:
            'Tower, PayPort, Blackbox, Beacon, Workbench, Helpdesk and Privacy: the operations layer a running SaaS needs, sold as source. No license keys, nothing gated.',
        heroImage: {
            url: '/ottabase-demo/whats-new/pro.webp',
            alt: 'The Tower admin page showing every deployment on one board, with health, cron and backup columns',
        },
        tags: ['Pro', 'Packages'],
        content: doc(
            p(
                'Ottabase Pro is the commercial layer on top of the framework: the packages a running SaaS needs once real customers arrive. They are sold as source, and access to the private repository is the license. There are no license keys, no feature gates and no phone-home anywhere in the packages.',
            ),
            table(
                ['Package', 'What it does'],
                [
                    '@ottabase/tower',
                    'Every Ottabase app you run, on one board: health, failing cron, last backup, version drift, alerts',
                ],
                [
                    '@ottabase/payport',
                    'Sell plans to your users and organizations: checkout, webhooks, licenses, plan limits, trials, lifecycle mail',
                ],
                [
                    '@ottabase/blackbox',
                    'Error tracking inside the app: Worker and browser errors grouped into issues, alerts on new and regressed',
                ],
                [
                    '@ottabase/beacon',
                    'A public status page at /status: components, incidents with a timeline, maintenance, email subscribers',
                ],
                [
                    '@ottabase/workbench',
                    'The database inside the admin: tables with their owning models, a read-only-by-default SQL console, saved queries',
                ],
                [
                    '@ottabase/helpdesk',
                    'A support inbox: mail and in-app requests become tickets, answered beside the customer plan and recent errors',
                ],
                [
                    '@ottabase/privacy',
                    'GDPR and CCPA requests: a queue with deadlines, one-click export, erasure that keeps invoices, all audited',
                ],
            ),
            h('Installed like any other package', 3),
            p(
                'Every Pro package is an ordinary kernel package plus the @ottabase/premium manifest. The repository is added as a subtree of your private monorepo, and one command wires the whole bundle into an app: dependencies, compositions, admin pages, user routes, cron tasks and table re-exports.',
            ),
            code(
                [
                    'git subtree add --prefix=packages/pro <pro-repo> main --squash',
                    'pnpm otta add pro otta-web   # or any one package: otta add tower otta-web',
                ].join('\n'),
                'bash',
            ),
            h('Licensed by people, not machinery', 3),
            ul(
                '<b>Three yearly tiers</b> sized by committer count: Solo, Team and Company. The packages are identical in every tier.',
                '<b>Cancel and keep the code.</b> The license to every version obtained while the subscription was active is perpetual; cancelling only ends access to new releases.',
                '<b>Repository access is the whole mechanism.</b> Purchase invites your GitHub account; lapse removes it. Nothing in the code enforces anything.',
            ),
            cta('See plans and pricing', 'https://ottabase.com/pro'),
        ),
    }),
    release({
        date: '2026-10-16',
        title: 'Packages that wire themselves in',
        slug: 'kernel-and-otta-add',
        isFeatured: true,
        excerpt:
            'A package contract in @ottabase/kernel, nine new platform packages, and otta add to install any of them with one command.',
        heroImage: {
            url: '/ottabase-demo/whats-new/packages.webp',
            alt: 'The ottabase/packages.ts file listing package manifests in one array',
        },
        tags: ['Packages', 'CLI'],
        content: doc(
            p(
                'A package now describes itself once: its tables, models, routes, cron jobs, queue handlers, events, navigation, environment and health checks. The app lists the manifests, and everything else is derived from that list.',
            ),
            h('New platform packages', 3),
            table(
                ['Package', 'What it does'],
                ['@ottabase/kernel', 'The package contract: definePackage, the registry, health and lifecycle'],
                ['@ottabase/events', 'A typed event bus, with queued subscribers'],
                ['@ottabase/flags', 'Plans, features and limits, with operator overrides'],
                ['@ottabase/meter', 'Atomic per-tenant usage credits, with top-ups and a ledger'],
                ['@ottabase/apikeys', 'Hashed, scoped, expiring and revocable API keys'],
                ['@ottabase/postmaster', 'Inbound email, a suppression list and one-click unsubscribe'],
                ['@ottabase/fleet', 'One health report for every deployment you run'],
                ['@ottabase/screenshot', 'PNG, JPEG and WebP captures via Browser Rendering or local Chrome'],
                ['@ottabase/legal', 'Terms, privacy, cookies, refunds and sub-processor pages'],
            ),
            h('otta add', 3),
            p(
                'One command installs a package into an app: the workspace dependency, its config file, its entry in the package list, the client key and the table re-exports. Running it twice is safe.',
            ),
            code(
                [
                    'otta add meter my-app --dry-run   # show what would change',
                    'otta add @ottabase/postmaster my-app',
                    'otta add vault                    # into the default app',
                ].join('\n'),
                'bash',
            ),
            h('Also new', 3),
            ul(
                '<b>otta-worker</b>, a second app template: one server-rendered Worker with an API and no single-page app. Start one with <code>otta new worker my-tool</code>.',
                '<b>Cloudflare wrappers</b> in @ottabase/cf for Vectorize, Workers AI, Browser Rendering, Workflows and Durable Object alarms.',
                '<b>Metered AI.</b> Platform-paid OttaAI calls can draw down @ottabase/meter credits. Calls made with a tenant’s own key are never billed.',
            ),
            cta('Read the package contract', `${REPO}/tree/main/packages/kernel`),
        ),
    }),
    release({
        date: '2026-10-11',
        title: 'Landing sites, straight from the database',
        slug: 'landing-sites-from-the-database',
        excerpt:
            'Landing sites are now edited in the admin and rendered from the shared database: three themes, lead forms with an inbox, social cards and private previews.',
        tags: ['Ottalanding'],
        content: doc(
            p(
                'Landing pages used to live in code. Now a site and its pages are rows in the shared D1 database, edited at <code>/admin/content/landing</code> and rendered by the otta-landing app on Next.js and Workers.',
            ),
            ul(
                '<b>Three themes</b>: Launch, Editorial and Bold, each with a light and a dark mode.',
                '<b>Ten section types</b>: hero, logos, features, testimonials, pricing, FAQ, call to action, contact, signup and free text.',
                '<b>Lead forms</b> with spam checks, an inbox in the admin (filter, reply, mark unread, export to CSV) and an optional email digest of new entries.',
                '<b>Social cards</b>: a 1200 × 630 card editor for each site or page, plus a generated sitemap and robots.txt.',
                '<b>Private previews</b>: a resettable link that shows a draft exactly as it will look, kept out of search engines.',
                '<b>Media library pickers</b> for images, logo and favicon, with alt text filled in for you.',
            ),
            warning(
                'Read-only by design',
                'The otta-landing app only ever reads. Every edit goes through the otta-web admin, so permissions and audit trails live in one place.',
            ),
        ),
    }),
    release({
        date: '2026-10-03',
        title: 'OttaAI reads images and answers in JSON',
        slug: 'ottaai-vision-and-json',
        excerpt:
            'Chat takes images and can return JSON against a schema. Plus blog import and export, author archives, a swipeable lightbox and a security sweep.',
        tags: ['OttaAI', 'Ottablog', 'Security'],
        content: doc(
            h('OttaAI', 3),
            ul(
                'Chat accepts inline images (JPEG, PNG, GIF and WebP) in user turns.',
                "Ask for <code>responseFormat: { type: 'json', schema }</code> and get JSON back, strictly validated where the route supports it.",
                'Tasks declare the capabilities they need, and only routes that have them are chosen.',
            ),
            code("tasks: [{ key: 'scan', requiredCapabilities: ['vision', 'json'], maxTokens: 4096 }]", 'typescript'),
            p(
                'Images have their own budget under <code>features.ottaai.images</code>: by default four per request, 4 MB each and 8 MB in total, with a per-user rate limit.',
            ),
            warning(
                'Breaking change',
                '/api/ai/complete is now text only. Send images to the new /api/ai/vision route instead.',
            ),
            h('Ottablog', 3),
            ul(
                'Author archives, one page per writer.',
                'Export the whole blog as one JSON file and import it elsewhere, or import Markdown with front matter from Jekyll, Hugo, Astro, Eleventy or Ghost, ten posts at a time.',
            ),
            h('Media library', 3),
            ul(
                'An immersive lightbox you can drag and swipe, with rubber-band edges, pinch to zoom and respect for reduced motion.',
            ),
            h('Security', 3),
            ul(
                'Role grants are scoped to an organization and fail closed.',
                'URL sanitizing blocks protocol-relative links, and shortlink interstitials refuse <code>javascript:</code> targets.',
                'Raw HTML blocks are sanitized when they render.',
                'Analytics is for system administrators only, and audit entries take their actor from the session.',
            ),
        ),
    }),
    release({
        date: '2026-09-20',
        title: 'Your blog, in more than one language',
        slug: 'multilingual-blog',
        excerpt:
            'Each blog picks its languages, each post carries translations with their own title, slug and schedule, and readers get the right one automatically.',
        tags: ['Ottablog', 'i18n'],
        content: doc(
            p(
                'A blog now has a list of languages and a default one. Every post has a canonical language, and each translation is its own piece of writing, with its own title, slug, excerpt, body, SEO fields, status and schedule.',
            ),
            h('For readers', 3),
            ul(
                'Choose a language with <code>?lang=fr</code>, or let the browser’s Accept-Language header decide.',
                'Localized slugs resolve directly, so <code>/blog/mon-article</code> finds the French version.',
                'When a translation is missing, the default language is served instead, if the blog allows it.',
                'Search, RSS and the sitemap are localized, with alternate links for every language.',
            ),
            h('For writers', 3),
            ul(
                'One writing workspace per language, with a guard against losing unsaved changes.',
                'In org mode, an organization inherits the platform’s languages until it saves its own.',
            ),
        ),
    }),
    release({
        date: '2026-09-16',
        title: 'Date archives, fuzzy dates and sharing',
        slug: 'archives-fuzzy-dates-sharing',
        excerpt:
            'Browse the blog by month, record when something was originally written even if you only roughly know, and share any post in one tap.',
        tags: ['Ottablog'],
        content: doc(
            ul(
                '<b>Date archives</b> at <code>/blog/archive/2026</code> and <code>/blog/archive/2026/9</code>.',
                '<b>Original date</b>: when a piece was first written, separate from when it was published. It can be as vague as the truth: “Early April 2023” and “Summer 2003” are both valid.',
                '<b>A share button</b> with copy link, X, Facebook, LinkedIn, email and the native share sheet.',
            ),
            p(
                'Two posts in this demo use original dates: <a href="/blog/three-days-of-light-in-lofoten">the Lofoten photo journal</a> and <a href="/blog/notes-from-2003">the notes rescued from 2003</a>.',
            ),
        ),
    }),
    release({
        date: '2026-09-10',
        title: 'Docs your AI assistant can read',
        slug: 'llms-txt-and-claude-skills',
        excerpt:
            'llms.txt and llms-full.txt index the whole repository for language models, and fourteen skills teach coding agents how Ottabase is built.',
        tags: ['Docs', 'AI'],
        content: doc(
            p(
                'Coding assistants are part of how people build now, so the repository explains itself to them as carefully as it does to people.',
            ),
            ul(
                '<b>llms.txt</b>, about 15 KB, is a map of the repository. <b>llms-full.txt</b>, about 1 MB, is the full text of every guide and README.',
                '<b>Fourteen skills</b> under <code>.claude/skills</code> cover the everyday jobs: models, CRUD, forms, RBAC, uploads, email, queues, cron, theming, components, packages, migrations, testing and Cloudflare.',
            ),
            code('pnpm docs:llms   # regenerate both files', 'bash'),
        ),
    }),
    release({
        date: '2026-09-03',
        title: 'A build cache you host yourself, and otta start',
        slug: 'otta-cache-and-otta-start',
        excerpt:
            'A self-hosted Turborepo remote cache on Workers and R2, and one command that starts any app with its whole development topology.',
        tags: ['Tooling', 'CLI'],
        content: doc(
            h('otta-cache', 3),
            p(
                'A Turborepo remote cache that runs on a Worker and keeps artifacts in R2. Tokens are stored as hashes and scoped per team, read or read-write. Uploads are create-only, and production can require signed artifacts. It sits deliberately outside the product: no ORM, no D1, no RBAC.',
            ),
            h('otta start', 3),
            p(
                'The old dev script is gone. <code>otta start</code> reads each app’s start topology from its package.json, launches every process, waits until each one is ready and tears everything down cleanly on exit. <code>pnpm dev</code> is now an alias for it.',
            ),
            code(
                [
                    'pnpm dev                                # the default app',
                    'pnpm otta start otta-web --env preview  # wrangler dev --local, never deploys',
                ].join('\n'),
                'bash',
            ),
        ),
    }),
    release({
        date: '2026-08-15',
        title: 'Short thoughts and photo journals',
        slug: 'blurbs-and-photo-journals',
        isFeatured: true,
        excerpt:
            'The blog learns two new shapes: blurbs for a quick thought and photo journals for stories told in pictures. Plus crossposts, a proper masthead and HTML to PDF.',
        heroImage: {
            url: '/ottabase-demo/whats-new/blog.webp',
            alt: 'The blog listing page with its Write menu and featured posts',
        },
        tags: ['Ottablog'],
        content: doc(
            p('A blog is not only articles. Two new content types now share the timeline with them.'),
            ul(
                '<b>Blurbs</b>: up to 1,000 characters of plain text, posted in seconds and shown inline in the timeline.',
                '<b>Photo journals</b>: an ordered album of up to 60 photographs with captions, places and dates, a field note of up to 2,000 characters, and an optional full article underneath for the story.',
            ),
            p(
                'This demo has both. Try <a href="/blog/slow-water-kerala-backwaters">Slow water</a> or <a href="/blog/three-days-of-light-in-lofoten">Three days of light in Lofoten</a>, and the short thoughts between the articles on the <a href="/blog">blog</a>.',
            ),
            h('Also new', 3),
            ul(
                '<b>Crossposts</b>: point a post at up to ten copies of it elsewhere, one of them marked as the original.',
                '<b>A proper masthead</b>: headline first, a serif display title, reading time above it and the hero image underneath.',
                '<b>@ottabase/cf-pdf</b>: HTML to PDF through Cloudflare Browser Rendering, with size and timeout caps and an origin allowlist.',
            ),
        ),
    }),
    release({
        date: '2026-07-21',
        title: 'Fuzzy dates, for when roughly is the truth',
        slug: 'ottadate-fuzzy-dates',
        excerpt:
            'A date picker that lets people say “early 90s” or “summer 98”, and stores exactly how sure they were.',
        tags: ['Ottadate'],
        content: doc(
            p(
                'Not every date is a timestamp. People remember “the summer we moved” or “sometime in the nineties”. The fuzzy picker in @ottabase/ottadate lets them say exactly that, and stores the precision with the date: a label for people, and an earliest and latest bound for machines.',
            ),
            table(
                ['You type', 'Ottadate reads'],
                ['early 90s', 'Early 1990s'],
                ['summer 98', 'Summer 1998'],
                ['late may 2010', 'Late May 2010'],
                ['1996ish', 'Around 1996'],
                ['banana', 'Nothing. It never guesses.'],
            ),
            code(
                [
                    "import { parseFuzzyInput } from '@ottabase/ottadate/parse';",
                    '',
                    "parseFuzzyInput('late may 2010');",
                    "// { label: 'Late May 2010', resolution: 'month', part: 'late', earliest, latest, ... }",
                ].join('\n'),
                'typescript',
            ),
            p(
                'The picker drills down from year to month to day, and the deeper you go, the more precise the date becomes. It is English only for now, and works with any framework.',
            ),
        ),
    }),
    release({
        date: '2026-07-17',
        title: 'Brand Engine v2 and a real platform owner',
        slug: 'brand-engine-v2-platform-owner',
        excerpt:
            'Brand kits now shape far more than colour, with no flash of the wrong theme. And admin access is decided by permission and scope, never by the name of a role.',
        tags: ['Brand Engine', 'RBAC'],
        content: doc(
            h('Brand Engine v2', 3),
            ul(
                'Brand kits can now set type scales, borders, focus rings, links, selection, scrollbars, effects and more. Every category is optional.',
                'Critical CSS for light and dark modes is injected at the edge, so a page never flashes the wrong theme.',
                'UI components expose <code>data-slot</code>, <code>data-variant</code> and <code>data-size</code> hooks for theming.',
                'The Brand Kit admin is a specimen gallery now, with a light and dark toggle and Ctrl+S to save. Verdant is the new default.',
            ),
            h('A real platform owner', 3),
            p(
                'The first user to bootstrap a deployment becomes the <b>platform owner</b>, a system-wide role kept separate from the owner of an organization. Admin screens check a permission and its scope, platform-wide or within one organization, instead of trusting role names, and generic CRUD now denies by default.',
            ),
            checklist(
                ['Platform admin needs a system-scoped platform:admin grant', true],
                ['Organization admin needs org:admin in that organization', true],
                ['A role named “owner” implies nothing on its own', true],
            ),
        ),
    }),
    release({
        date: '2026-07-05',
        title: 'Goodbye Auth.js, hello in-house auth',
        slug: 'in-house-auth',
        excerpt:
            'Authentication is now a small package built on Web Crypto: sessions, passwords, OAuth with PKCE and magic links, with no dependencies.',
        tags: ['Auth', 'Security'],
        content: doc(
            p(
                '@ottabase/auth replaces Auth.js. It has no dependencies, uses only Web Crypto, and fails closed when its session store is missing.',
            ),
            ul(
                'Signed session cookies, backed by a KV registry so sessions can be revoked one at a time or all at once.',
                'Email and password sign-in, with PBKDF2 password hashing and double-submit CSRF protection.',
                'OAuth 2 and OpenID Connect with PKCE, with presets for Google, GitHub, Discord, Azure AD and Auth0.',
                'Magic-link sign-in by email, valid for fifteen minutes.',
            ),
            p(
                'It does less than Auth.js, on purpose. There are no passkeys or two-factor codes yet, and it never stores the access tokens your OAuth providers hand back.',
            ),
            cta('Read the auth guide', `${REPO}/tree/main/packages/auth`),
        ),
    }),
];
