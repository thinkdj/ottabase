# Homepage vNEXT — Roadmap

> Roadmap for the Next.js homepage template: deep integration with the Ottabase core framework and feature enhancements for the dynamic, slot-based homepage system.

---

## 1. Core Framework Integration

### 1.1 Database-Backed Content (OttaORM + D1)

**Goal:** Store homepage section content in Cloudflare D1 so that all slots (hero, features, CTA, about, etc.) render from a single source of truth — edit once, render any way you want.

- [ ] Add Cloudflare D1 binding to `wrangler.jsonc` and `cloudflare-env.d.ts`
- [ ] Create `HomepageSection` model using OttaORM `BaseModel`:
  ```typescript
  // Schema: id, sectionType (hero|features|cta|about), contentJson, sortOrder, isActive, createdAt, updatedAt
  export class HomepageSection extends BaseModel {
    static entity = 'homepage_sections';
    static table = homepageSectionsTable;
    static primaryKey = 'id';
  }
  ```
- [ ] Create `HomepageFeature` model for the features list (title, description, icon, sortOrder)
- [ ] Create `HomepageAction` model for CTA buttons (label, href, variant, isExternal)
- [ ] Wire models into `db-utils.ts` and register in `schemas-helper.ts` for auto-migration
- [ ] Create API routes: `GET /api/homepage/sections`, `PATCH /api/homepage/sections/:id`
- [ ] Refactor `SlotRenderer` to accept data from DB queries (SSR via `fetch()` in server components) while falling back to static defaults when no DB is configured
- [ ] Add seed script to populate initial content matching current static data

### 1.2 Brand Engine Persistence

**Goal:** Save the active theme preset and slot variant selections in the database so configuration survives across browsers and can be managed by admins.

- [ ] Use `@ottabase/brand-engine/persistence` (`BrandKit`, `LayoutTemplate`, `MenuSlotAssignment`) models
- [ ] Store active theme preset + slot config in `BrandKit` table instead of (or in addition to) localStorage
- [ ] Add admin endpoint: `POST /api/brand/homepage-config` to save config
- [ ] ConfigPanel reads from DB on mount (with localStorage as cache/fallback)
- [ ] Multi-tenant support: different orgs can have different homepage configs

### 1.3 Authentication Integration

**Goal:** Add optional auth so that admins can edit homepage content via an inline editing UI.

- [ ] Wire `@ottabase/auth` with D1 adapter into the homepage worker
- [ ] Add optional login/signup button in navbar (hidden when auth is not configured)
- [ ] Create `AdminGuard` wrapper that shows edit controls only when authenticated as admin
- [ ] Inline edit mode: click-to-edit hero text, feature cards, CTA copy — saves to DB via OttaORM
- [ ] Role check via `@ottabase/rbac` for admin-only editing permissions

### 1.4 Media & File Uploads

**Goal:** Allow hero images, feature icons, and logo to be uploaded and served from Cloudflare R2.

- [ ] Add R2 binding for asset storage
- [ ] Integrate `@ottabase/ottaupload` for drag-and-drop image upload in admin mode
- [ ] Store media references in `@ottabase/medialibrary` `Media` model
- [ ] Hero variants can render a dynamic background image from R2
- [ ] Feature cards support uploaded icons/illustrations

### 1.5 Blog Integration

**Goal:** Surface recent blog posts on the homepage as a dynamic section.

- [ ] Add a `blog` slot with variants: `BlogLatest` (3-card grid), `BlogFeatured` (single spotlight), `BlogList` (compact list)
- [ ] Fetch posts from `@ottabase/ottablog` `Post` model via API: `GET /api/ottaorm/posts?limit=3&orderBy=createdAt`
- [ ] Link to full blog powered by ottablog package
- [ ] Support draft/published filtering, tag-based filtering

### 1.6 Analytics & Tracking

**Goal:** Track page views and section engagement using Cloudflare Analytics Engine.

- [ ] Integrate `@ottabase/analytics` for page-view tracking
- [ ] Add section-level visibility tracking (which hero/features/CTA variants get more engagement)
- [ ] Dashboard widget showing homepage analytics in admin panel
- [ ] A/B testing support: randomly assign visitors to different slot variants and track conversion

### 1.7 Email & Newsletter

**Goal:** Add a newsletter signup component as a homepage slot.

- [ ] Create `newsletter` slot with variants: inline form, modal popup, footer-embedded
- [ ] Integrate `@ottabase/email` for sending confirmation emails
- [ ] Store subscribers in a `NewsletterSubscriber` OttaORM model
- [ ] Double opt-in flow with verification token

### 1.8 Comments & Feedback

**Goal:** Allow visitors to leave feedback or testimonials.

- [ ] Create `testimonials` slot using `@ottabase/comments` for user-submitted reviews
- [ ] Admin moderation panel for approving/rejecting testimonials
- [ ] Display approved testimonials in a carousel or grid variant

### 1.9 Real-Time Updates

**Goal:** Push live content updates to visitors without page reload.

- [ ] Integrate `@ottabase/cf-realtime` WebSocket pub/sub
- [ ] Admin edits to homepage content broadcast live to connected visitors
- [ ] Live visitor count display (optional widget)

---

## 2. Feature Enhancements

### 2.1 New Slot Types

- [ ] **Pricing** — pricing table with tiers (Free, Pro, Enterprise) and feature comparison
- [ ] **FAQ** — accordion-based frequently asked questions section
- [ ] **Team** — team member cards with photos, roles, and social links
- [ ] **Testimonials** — customer quotes in carousel, grid, or marquee layouts
- [ ] **Stats/Metrics** — animated counters showing key numbers (users, uptime, etc.)
- [ ] **Integrations/Partners** — logo cloud with partner/integration badges
- [ ] **Changelog** — recent updates feed (could pull from `ChangelogEntry` model)
- [ ] **Contact** — contact form with email integration via `@ottabase/email`
- [ ] **Blog Preview** — latest posts section (see §1.5)
- [ ] **Newsletter** — email signup section (see §1.7)

### 2.2 Enhanced Config Panel UX

- [ ] Drag-and-drop slot reordering (change section order on the homepage)
- [ ] Live preview thumbnails for each variant option
- [ ] Import/export config as JSON for sharing configurations
- [ ] Undo/redo for config changes
- [ ] Preset homepage layouts (e.g., "SaaS Landing", "Developer Docs", "Portfolio")
- [ ] Section visibility toggle (show/hide individual slots without removing them)

### 2.3 Animation & Transitions

- [ ] Scroll-triggered fade-in animations for each section
- [ ] Smooth section transitions when switching variants in the config panel
- [ ] Parallax effects for hero backgrounds
- [ ] Animated number counters for stats sections
- [ ] Page transition animations between routes

### 2.4 SEO & Performance

- [ ] Dynamic `<meta>` tags and Open Graph data from DB content
- [ ] JSON-LD structured data for homepage sections
- [ ] Automatic sitemap generation including dynamic pages
- [ ] Image optimization pipeline (WebP/AVIF via Cloudflare Images)
- [ ] Critical CSS extraction per active variant combination
- [ ] Lighthouse CI integration for automated performance monitoring

### 2.5 Internationalization (i18n)

- [ ] Multi-language support for all homepage content
- [ ] Language switcher in navbar
- [ ] DB-backed translations per section and locale
- [ ] RTL layout support
- [ ] Automatic browser locale detection

### 2.6 Multi-Page Support

- [ ] Extend slot system to arbitrary pages (not just homepage + about)
- [ ] Page builder: create new pages with drag-and-drop slot composition
- [ ] Dynamic routes from DB: `/pages/:slug` renders slot-composed pages
- [ ] Navigation auto-generated from page registry

### 2.7 Developer Experience

- [ ] CLI command: `pnpm ottabase homepage:seed` to populate DB with sample content
- [ ] CLI command: `pnpm ottabase homepage:export` to export current config
- [ ] Storybook stories for every slot variant (visual documentation)
- [ ] Variant development mode: hot-reload preview of variant changes
- [ ] TypeScript codegen for slot data types from DB schema

### 2.8 Deployment & Multi-Tenancy

- [ ] Per-tenant homepage configuration (different orgs get different homepages)
- [ ] Custom domain mapping per tenant homepage
- [ ] Preview deployments with config snapshots
- [ ] Staging/production config promotion workflow
- [ ] Config versioning with rollback support

---

## Priority Tiers

### Tier 1 — Foundation (Do First)
1. §1.1 Database-backed content (OttaORM models for sections)
2. §1.2 Brand engine persistence (save config to DB)
3. §2.2 Enhanced config panel (reorder, show/hide, presets)
4. §2.1 New slots: Pricing, FAQ, Testimonials

### Tier 2 — Growth
5. §1.3 Authentication + inline editing
6. §1.5 Blog integration
7. §1.4 Media uploads (R2)
8. §2.4 SEO and performance
9. §2.3 Animations

### Tier 3 — Scale
10. §1.6 Analytics and A/B testing
11. §1.7 Newsletter integration
12. §2.5 Internationalization
13. §2.6 Multi-page support
14. §2.8 Multi-tenancy

### Tier 4 — Polish
15. §1.8 Comments and testimonials from users
16. §1.9 Real-time updates
17. §2.7 Developer experience tooling
