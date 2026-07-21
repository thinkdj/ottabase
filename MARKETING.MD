# Ottabase Marketing Kit

One place for everything about Ottabase that you can share with the world. Grab a snippet, drop it into Product Hunt, a
tweet, a landing page, or an email, and go.

- Name: Ottabase
- Author: Deepak Thomas ([@thinkdj](https://twitter.com/thinkdj))
- Repo: https://github.com/thinkdj/ottabase
- Demo: https://demo.ottabase.com
- License: MIT (you own the code)
- One-liner: An edge-native SaaS framework for Cloudflare Workers. Clone it, ship a multi-tenant SaaS in hours.

> Note for reuse: this file has no em-dashes and no emojis on purpose, so you can paste it anywhere without cleanup.

---

## ABOUT (5 lengths)

Pick the length that fits the surface you are filling.

**1. One-liner (tweet, headline, meta description)**

Ottabase is an edge-native SaaS framework for Cloudflare Workers. Clone it and ship a multi-tenant SaaS in hours instead
of months.

**2. Short pitch (Product Hunt tagline, app store blurb)**

A batteries-included monorepo that hands solo founders a full SaaS backend on day one: auth, RBAC, multi-tenancy, an ORM,
a blog, file uploads, realtime, queues, and close to 50 packages, all running on Cloudflare's edge.

**3. Medium (Product Hunt intro, README top, directory listing)**

Ottabase is an edge-native SaaS framework you clone instead of install. It runs entirely on Cloudflare Workers with D1,
KV, R2, Queues, and Durable Objects, so there is no separate server or database to manage. Out of the box you get custom
auth, role-based access control, row-level security, multi-tenant organizations, an ORM with fat models, a blog and CMS,
media uploads, realtime, notifications, analytics, and a UI kit. You start building your product on line one instead of
wiring plumbing for two weeks.

**4. Long (landing page section, about page)**

Every SaaS needs the same boring plumbing before it can do anything interesting: sign-in, permissions, tenants, an ORM,
file uploads, a settings screen, a blog, email. Most people rebuild this from scratch every time, or glue together five
services and spend weeks on integration.

Ottabase gives you all of it in one integrated monorepo. It is built edge-first on Cloudflare Workers, so your app runs
close to your users worldwide with predictable costs and no servers to babysit. The domain logic lives in fat models
(think Laravel or Rails, but TypeScript on the edge), permissions and tenant isolation are enforced by default, and
close to 50 packages cover the features you would otherwise bolt on later.

You do not install Ottabase from npm. You clone it and make it yours. That means no version skew across packages, no
black-box dependencies, and full control over your own product.

**5. Full elevator pitch (investor note, deep intro, press)**

Ottabase is a full-stack SaaS framework for founders who want to ship, not assemble. It is a single TypeScript monorepo
that runs entirely on Cloudflare's edge network. Instead of stitching together a frontend, a backend host, a database, a
cache, an auth provider, and a file store, you clone one repo that already has all of them working together.

The core is OttaORM, a fat-model layer where your business logic lives next to your data, with auto-migrations, CRUD, and
relationships. Around it sit the pieces a real SaaS needs from day one: custom dependency-free auth with OAuth and magic
links, permission-and-scope RBAC, row-level security that blocks cross-tenant leaks automatically, multi-tenant
organizations, audit logging, queues, cron, realtime over WebSockets, notifications, analytics, a blog and CMS, a
media library, forms generated from your models, and a themeable UI kit.

Because it is Cloudflare-native, apps deploy globally with minimal cold starts and costs you can predict, and there is no
Postgres box, Redis instance, or S3 bucket to run. Ottabase is a clone-and-own monorepo, not a hosted service or an npm
package, so you keep full control of your code and your infrastructure. It is aimed squarely at solo founders and small
teams who want the speed of a platform with the freedom of owning their stack.

---

## TAGLINES

Short, punchy lines that are ready for social, buttons, and headers.

- Ship your SaaS this weekend, not this quarter.
- The backend is already built. Go build your product.
- Clone it. Own it. Ship it.
- Everything a SaaS needs, running on the edge.
- Batteries included, servers not required.
- Your whole backend in one repo, live at the edge.
- From clone to deployed on Cloudflare in an afternoon.
- Multi-tenant, secure, and edge-native out of the box.
- Stop wiring plumbing. Start shipping features.
- One monorepo. Zero servers. Global by default.
- Built by a solo founder, for solo founders.

---

## FEATURES

Everything worth mentioning, grouped so you can pull just the section you need.

### The core

- **Edge-native runtime.** Runs entirely on Cloudflare Workers. No origin server, no separate database host.
- **OttaORM fat models.** Your schema, validation, relationships, and business logic live in one model class. Simple,
  readable, and easy to test. Familiar if you have used Laravel Eloquent or Rails Active Record.
- **Auto-migrations.** Tables are created from your schema with one call. Add a column, re-run init, done.
- **Type-safe end to end.** TypeScript everywhere, from the database to the React hooks. No JavaScript escape hatches.
- **Model-driven CRUD.** A generic API and matching client hooks (TanStack Query) are generated from your models, so a
  new entity is usable from the frontend with almost no glue code.

### Auth and access control

- **Custom auth, no heavy dependencies.** Sessions are signed tokens in secure cookies, built on Web Crypto. No Auth.js.
- **Sign-in options.** OAuth with Google, GitHub, Discord, Azure AD, and Auth0, plus email magic links and classic
  credentials.
- **Instant session revocation.** Sign-out kills a single session right away.
- **RBAC by permission and scope.** Access is decided by what a role can actually do and where, never by a role's name.
  This closes a whole class of privilege bugs.
- **Row-level security.** Tenant, user, and app filters are injected into queries automatically, so cross-tenant leaks
  are blocked by default and logged when attempted.
- **Multi-tenant organizations.** Organizations, members, roles, invites by email, and org switching are built in. There
  is also a single-founder mode when you do not need tenants.
- **Audit logging.** Every create, update, delete, and auth event is recorded with who, what, when, where, and a
  before-and-after diff.

### Content and branding

- **Brand Engine.** One brand file controls colors, fonts, type scale, spacing, radius, shadows, motion, focus rings,
  links, scrollbars, and more. Themes are injected at the edge so there is no flash of unstyled content. Ships with
  ready-made presets, live theme switching, and dark mode.
- **Blog and CMS (OttaBlog).** Posts, categories, tags, series, and versioning, plus a Blog Studio admin.
- **Threaded comments.** Nested replies as a drop-in package.
- **Media library.** Upload, browse, and manage images and files.
- **Rich editor (OttaEditor).** An EditorJS wrapper with 30 blocks (13 EditorJS plus 17 custom), including custom ones
  like Spoiler, CTA, and Review.
- **Layout presets (OttaLayout).** Ready-made page layouts with slots you can swap.

### Growth and infrastructure

- **Realtime.** WebSocket pub/sub over Durable Objects. A drop-in alternative to Pusher.
- **Queues.** A job queue with dispatch, handlers, deduplication, chaining, and priority.
- **Cron.** Scheduled jobs, both code-defined and database-scheduled.
- **Notifications.** Multi-channel: email, WebSocket, and in-system.
- **Email.** Send through Resend, Amazon SES, MailChannels, or SMTP.
- **Analytics.** Events, funnels, and top-K queries on Cloudflare Analytics Engine.
- **Shortlinks.** A built-in URL shortener with interstitial pages, expiry, and click tracking.
- **Referrals.** First-touch referral attribution tracking.
- **AI Gateway.** Cloudflare AI Gateway support for AI features at the edge.

### UI kit

- shadcn/ui and Mantine component packages, plus shared base components.
- Command palette (Spotlight), resizable split pane, code syntax highlighting, a data table, and a headless
  select/combobox.
- A tiny vanilla JavaScript image cropper (around 3 to 4 KB, zero dependencies).
- Auto-generated CRUD forms from your OttaORM models.
- OttaDate, a framework-agnostic date picker with range, datetime, and fuzzy modes. The fuzzy mode captures
  half-remembered dates like "Summer 1998" or "Early 1990s" and still stores a real, queryable date range.
- A markdown docs viewer for in-app documentation.

### Developer experience

- **Monorepo done right.** pnpm workspaces plus Turborepo. Ship changes across apps and packages together, with no
  version skew.
- **Otta CLI.** Scaffold new apps, run dev servers, build, test, and lint from one command.
- **Two ready templates.** A full-stack app on TanStack Router, Vite, and Workers, and a marketing site on Next.js and
  OpenNext.
- **GUI bootstrap wizard.** First-run setup is a guided web flow, not a list of curl commands.
- **Storybook, Vitest, and CI** wired up from the start.
- **Internationalization.** i18next with English, Spanish, French, and German included.

---

## POSITIONING AND NUANCE

Things that make Ottabase specific. Useful when a listing asks "how are you different."

- **You own the code.** Ottabase is a monorepo you clone and modify, not an npm package you install or a service you
  rent. No black boxes, no per-seat pricing, no vendor holding your data.
- **Cloudflare-first, on purpose.** Workers, D1, KV, R2, Queues, and Durable Objects are first-class, not adapters. The
  honest trade-off is that Ottabase is coupled to Cloudflare, and that is called out openly in the README.
- **Build the product, not the backend.** Compared to a do-it-yourself stack (Next.js plus Supabase plus Stripe plus an
  auth service plus a file store), there is no integration phase. It is already integrated.
- **Where it sits.** Think of it next to Supabase, Railway, and Convex, but as a framework you own rather than a platform
  you configure. Supabase gives you a backend to wire up. Ottabase gives you the whole app to start editing.
- **Opinionated by design.** Strong defaults and clear patterns (fat models, thin routes, security on by default) so you
  spend decisions on your product, not your architecture.
- **Best fit.** Solo founders and small teams shipping a multi-tenant SaaS who want speed without giving up control.

---

## STORY

Best-effort guess based on the repo. Please correct or replace this with the real story.

Ottabase looks like the answer to a problem its author kept hitting: every new SaaS starts with the same weeks of
plumbing before you can build the actual product. Auth, permissions, tenants, an ORM, uploads, a blog, email, all rebuilt
or re-glued each time. So instead of starting over again, the plumbing got built once, properly, on Cloudflare's edge,
and turned into a monorepo you can clone and own rather than a service you rent.

It is openly a solo-founder project (the docs literally say "built by a solo founder, for solo founders"), which shows in
the priorities: ship fast, keep costs predictable, own your stack, and do not depend on a pile of paid third-party
services. The "Otta" naming runs through everything (OttaORM, OttaRouter, OttaBlog, OttaEditor, OttaDate), giving the
whole toolkit one identity.

_(Real origin, timing, and the meaning behind the name: left for you to fill in.)_

---

## TIMELINE

- **Project copyright:** 2025 to 2026 (the project predates the public git window below).
- **Public 1.0.0 release:** April 6, 2026 (first public open-source release of the monorepo, per the changelog).
- **First commit in the current repo history:** July 5, 2026 ("UI Touchup: OttaRenderer and OttaEditor to follow core
  theme vars").
- **Latest commit:** July 21, 2026 ("OttaDate: fuzzy date picker with derived-resolution model and parser").
- **Scale today:** 2 app templates and close to 50 workspace packages.

Note: the visible git history is a recent working window (early to late July 2026). The 1.0.0 date and the 2025 copyright
show the project itself is older than these commits.

---

## CHANGELOG (marketing view)

Read for the highlights, not the raw commits. Grouped by what a user or reader would care about.

### Newest first (July 2026)

- **OttaDate, a fuzzy date picker (Jul 21).** A new framework-agnostic date picker with range and datetime modes, plus a
  fuzzy mode for half-remembered dates like "Summer 1998" that still resolve to a real, queryable date range.
- **Leaner, Cloudflare-only stack (Jul 19).** Removed dead Prisma and MongoDB backends and dropped Prisma from the
  install graph entirely. The framework is now cleanly edge-native with nothing to trip over.
- **Big multi-tenant security pass (Jul 14 to Jul 19).** A major hardening wave. Access control now checks real
  permissions and scope instead of role names, generic data access is default-deny (an allowlist, not a denylist),
  row-level security closed several cross-tenant leaks, and first-run bootstrap endpoints are rate-limited against
  brute force. In short: multi-tenant isolation you can trust.
- **Platform owner versus org owner (Jul 16 to Jul 17).** A clean separation between the person who runs the whole
  platform and someone who just owns a single organization, so a normal signup can never reach the admin control plane.
- **Brand Engine v2 (Jul 16).** The theming system became a full design system. One brand file now drives colors, fonts,
  type scale, radius, shadows, motion, focus rings, links, scrollbars, and effects, with two complete example themes
  shipped as references. Themes paint at the edge with no flash of unstyled content.
- **Threaded comments (Jul 16).** A new comments package with nested replies, shipped with security, correctness, and
  performance fixes.
- **Bootstrap and admin console (Jul 18).** One-click web pages to seed roles, promote an owner, and send a test email.
  Setup and recovery are now a guided UI instead of curl commands.
- **Faster authenticated requests.** Membership lookups are now cached in KV, replacing 2 to 4 database queries per
  request with a single cache read, without weakening access checks.
- **New zero-dependency router (OttaRouter).** A Cloudflare Workers router with order-free route precedence and
  middleware, so route order stops being a footgun.
- **Invite teammates by email (Jul 14).** Add members to an organization by email address, with the right role assigned
  automatically.
- **Shortlink interstitials (Jul 14 to Jul 15).** The built-in URL shortener got a polished interstitial page with click
  tracking.
- **Smaller, faster bundles.** The worker bundle and first-load JavaScript both shrank, so pages load quicker.
- **UI uplift across the board (Jul 5 to Jul 6).** A visual refresh across the blog, editor, renderer, admin, template
  app, and demos, plus a cleaner brand kit logo upload flow.

### Foundation (April 2026)

- **Ottabase 1.0.0, public release (Apr 6).** The first public open-source release of the monorepo: the edge-native
  architecture, the primary app and homepage templates, OttaORM fat models, multi-tenant RBAC and row-level security,
  auto-migrations, and the broad package ecosystem.

---

## QUICK FACTS AND COPY BLOCKS

Handy when a form asks for structured details.

- **Category:** SaaS framework, developer tools, backend, full-stack, edge computing.
- **Runs on:** Cloudflare Workers, D1, KV, R2, Queues, Durable Objects, Analytics Engine, AI Gateway.
- **Built with:** TypeScript, React, TanStack Router, Vite, Next.js, Drizzle, EditorJS, pnpm, Turborepo.
- **Requirements:** Node 24+, pnpm 10+, a Cloudflare account (free tier is enough to start).
- **Pricing model:** Free and open source under MIT. You deploy to your own Cloudflare account, so you pay Cloudflare for
  usage, nothing to Ottabase.
- **Keywords:** ottabase, saas, framework, monorepo, typescript, cloudflare, workers, edge, orm, d1, kv, r2, rbac, rls,
  auth, multi-tenant.
- **Links:** Repo https://github.com/thinkdj/ottabase, Demo https://demo.ottabase.com, Discussions
  https://github.com/thinkdj/ottabase/discussions.

**Boilerplate paragraph (paste at the end of a post or press note):**

Ottabase is an open-source, edge-native SaaS framework for Cloudflare Workers. It is a clone-and-own TypeScript monorepo
that gives solo founders and small teams a complete SaaS backend on day one: auth, RBAC, multi-tenancy, an ORM, a blog,
uploads, realtime, and close to 50 packages. It is MIT licensed and built by [@thinkdj](https://twitter.com/thinkdj).
Learn more at https://github.com/thinkdj/ottabase.
