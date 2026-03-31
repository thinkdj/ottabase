# Marketing Pages / Homepage Builder — Enhancement Roadmap

> Enhancements to make the Ottabase dynamic site builder **top-notch for SaaS founders**. Prioritized by impact for
> early-stage SaaS teams who need to ship fast.

---

## 🔴 P0 — Ship-Critical (Week 1-2)

### 1. Page Templates & One-Click Starters

**Problem:** Founders stare at a blank canvas. No starter templates exist. **Solution:**

- Pre-built template gallery: SaaS Landing, Pricing Page, Changelog, Waitlist, Coming Soon
- "Start from template" in page creation flow — seeds sections + features + actions
- Templates stored as JSON configs, loadable via `POST /api/pages/from-template`
- Allow users to save their own pages as reusable templates

### 2. SEO Metadata Per Page

**Problem:** `pagesTable` has no SEO fields. Founders can't set meta tags for Google/social. **Solution:**

- Add `seoTitle`, `seoDescription`, `ogImage`, `canonicalUrl` columns to `pagesTable`
- SEO editor tab in page builder (title, description, OG image picker, canonical URL)
- Render `<meta>` tags in `MarketingPageRenderer` and Next.js `[slug]` page
- Auto-generate `seoTitle` from page title if empty
- Schema: `seoTitle text, seoDescription text, ogImage text, canonicalUrl text`

### 3. Image/Media Support in Sections

**Problem:** Feature icons are text-only. No image upload for hero backgrounds, feature images, etc. **Solution:**

- Add `imageUrl` column to `pageSectionsTable` and `pageFeaturesTable`
- Integrate existing `@ottabase/medialibrary` picker in builder UI
- Hero section: background image support with overlay
- Features: image/icon toggle per feature item
- `imageUrl` renders in all slot renderers

### 4. Form Block (Lead Capture / Waitlist)

**Problem:** No way to capture emails, sign-ups, or waitlist entries from marketing pages. **Solution:**

- New `form` block type with variants: `newsletter`, `waitlist`, `contact`
- New `page_submissions` table: `id, pageId, sectionId, email, name, data (JSON), createdAt`
- `FormSection` renderer with email input + submit button
- Webhook/notification on submission (integrate with `@ottabase/notifications`)
- Admin view: list submissions per page with CSV export

### 5. Custom Styling Per Section

**Problem:** All sections use hardcoded Tailwind classes. No per-section color/spacing control. **Solution:**

- Add `metadata` JSON column to `pageSectionsTable` for: `backgroundColor`, `textColor`, `paddingY`, `fullWidth`
- Style picker in Block Editor: background color, text color, padding presets
- Renderer applies inline styles + Tailwind overrides from metadata
- Presets: Light, Dark, Primary, Accent, Gradient

---

## 🟡 P1 — High-Impact (Week 3-4)

### 6. Live Preview Panel

**Problem:** Preview opens in a new tab. No inline preview while editing. **Solution:**

- Split builder view: editor left, live preview iframe right
- Device switcher: Desktop (100%), Tablet (768px), Mobile (375px)
- Auto-refresh preview on save
- "Full Preview" button still available for full-screen view

### 7. Testimonials / Social Proof Block

**Problem:** SaaS founders need testimonials, logos, and social proof — most common landing page section. **Solution:**

- New `testimonials` block with variants: `cards`, `carousel`, `wall`
- Fields: quote, author name, author title, author avatar (image URL), company, rating
- New `page_testimonials` table or reuse `page_features` with extended fields
- Logo cloud variant for "Trusted by" sections

### 8. Pricing Block

**Problem:** Pricing tables are essential for SaaS — currently no way to build them. **Solution:**

- New `pricing` block with variants: `simple`, `comparison`, `toggle` (monthly/annual)
- Features as pricing tiers: title (plan name), description (price), features list
- Actions as CTA buttons per tier
- Highlighted/recommended tier support via metadata

### 9. Page-Level Analytics

**Problem:** No tracking on rendered marketing pages. Can't measure conversion. **Solution:**

- Integrate `@ottabase/analytics` track() in MarketingPageRenderer
- Auto-track: page_view, section_view (intersection observer), cta_click
- Analytics dashboard widget in admin showing page views and CTA clicks
- UTM parameter capture and pass-through to action URLs

### 10. Undo/Redo in Builder

**Problem:** No way to revert accidental changes in the builder. **Solution:**

- Operation stack using React state (last 20 operations)
- Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts
- Operations: add block, delete block, reorder, edit content, toggle visibility
- Visual undo/redo buttons in builder toolbar

---

## 🟢 P2 — Differentiators (Month 2)

### 11. A/B Testing for Sections

**Problem:** Founders can't test different hero copy, CTA variants, or feature arrangements. **Solution:**

- A/B test model: `page_experiments` table with experiment name, section pairs, traffic split %
- Variant assignment via cookie/localStorage (consistent per visitor)
- Automatic winner detection based on CTA click rates
- "Run A/B Test" button on any section in the builder

### 12. Animation & Scroll Effects

**Problem:** Pages feel static. No entrance animations or scroll-triggered effects. **Solution:**

- Add `animation` field to section metadata: `fadeIn`, `slideUp`, `slideLeft`, `zoomIn`, `none`
- Implement with CSS `@keyframes` + Intersection Observer (no heavy JS library)
- Animation preview in builder
- Parallax option for hero background images

### 13. FAQ / Accordion Block

**Problem:** FAQ sections are critical for SaaS landing pages — reduces support load. **Solution:**

- New `faq` block with variants: `accordion`, `two-column`, `simple`
- Features as Q&A pairs: title = question, description = answer
- Shadcn Accordion component in renderer
- Schema.org FAQ structured data output for SEO

### 14. Version History & Revisions

**Problem:** No way to see what changed or revert to a previous state. **Solution:**

- `page_revisions` table: snapshot of page + sections on each publish
- "History" tab in builder showing revision timeline
- One-click restore to any previous revision
- Diff view showing what changed between versions

### 15. Global Header/Footer

**Problem:** Each page must add its own navbar/footer. No shared layout. **Solution:**

- "Global sections" concept: navbar/footer marked as global, shared across all pages
- Global section editor in page settings
- Override per page if needed
- Rendered automatically when page has no navbar/footer section

### 16. Custom Domain & Multi-Page Site

**Problem:** Pages are individual — no concept of a "site" with navigation. **Solution:**

- Site model: groups multiple pages with shared navbar, footer, and domain
- Auto-generated navigation from published pages
- Custom domain mapping (CNAME → Cloudflare Workers)
- Sitemap.xml auto-generation

### 17. Integrations Block

**Problem:** SaaS founders need to embed external tools (Calendly, Typeform, Stripe, etc.). **Solution:**

- New `embed` block type with variants: `iframe`, `script`, `widget`
- URL/embed code input in block editor
- Sandboxed iframe rendering with configurable height
- Pre-built integrations: Calendly booking, Stripe checkout, YouTube/Vimeo

### 18. Blog/Changelog Integration

**Problem:** `@ottabase/ottablog` exists but isn't surfaced in marketing pages. **Solution:**

- New `blog-feed` block showing latest N posts from ottablog
- New `changelog` block showing recent changelog entries
- Link to full blog/changelog pages
- Auto-update when new posts are published

---

## 🔵 P3 — Polish & Delight (Month 3+)

### 19. AI Copy Assistant

**Problem:** Writing marketing copy is hard. Founders spend hours on headlines. **Solution:**

- "Generate with AI" button on title/subtitle/body fields
- Uses `@ottabase/cf-ai` for copy generation
- Prompt templates: "Write a SaaS hero headline for [product description]"
- Tone selector: Professional, Casual, Bold, Playful

### 20. Component Marketplace

**Problem:** Limited to built-in blocks. No community or ecosystem. **Solution:**

- Block packages: npm-installable block definitions + React components
- `registerCustomBlock()` API already exists — build discovery layer on top
- Block preview gallery showing available marketplace blocks
- Versioning and update mechanism

### 21. Collaborative Editing

**Problem:** Single-user editing. No team collaboration. **Solution:**

- Real-time presence indicators (who's editing what)
- Use existing `@ottabase/cf-realtime` WebSocket infrastructure
- Lock sections being edited by others
- Activity feed showing recent changes by team members

### 22. Performance Score

**Problem:** No visibility into page load performance. **Solution:**

- Lighthouse-style performance score per page
- Image optimization warnings (too large, missing alt text)
- Bundle size estimation
- Core Web Vitals predictions based on section count and complexity

### 23. Multi-Language Pages (i18n)

**Problem:** SaaS companies need pages in multiple languages. **Solution:**

- Language selector in page builder
- Duplicate page content per locale
- Language switcher component in navbar
- Use existing `@ottabase/i18n` package for translation management

### 24. Conversion Funnels

**Problem:** No way to chain pages into a funnel (Landing → Pricing → Signup). **Solution:**

- Funnel builder: define page sequence with conversion tracking
- Auto-link CTA buttons to next funnel step
- Funnel analytics: drop-off rate per step
- A/B test entire funnel paths

---

## Summary Matrix

| #   | Enhancement            | Impact | Effort | Priority |
| --- | ---------------------- | ------ | ------ | -------- |
| 1   | Page Templates         | 🔥🔥🔥 | Low    | P0       |
| 2   | SEO Metadata           | 🔥🔥🔥 | Low    | P0       |
| 3   | Image/Media Support    | 🔥🔥🔥 | Medium | P0       |
| 4   | Form / Lead Capture    | 🔥🔥🔥 | Medium | P0       |
| 5   | Custom Section Styling | 🔥🔥   | Low    | P0       |
| 6   | Live Preview           | 🔥🔥   | Medium | P1       |
| 7   | Testimonials Block     | 🔥🔥🔥 | Medium | P1       |
| 8   | Pricing Block          | 🔥🔥🔥 | Medium | P1       |
| 9   | Page Analytics         | 🔥🔥   | Medium | P1       |
| 10  | Undo/Redo              | 🔥🔥   | Medium | P1       |
| 11  | A/B Testing            | 🔥🔥   | High   | P2       |
| 12  | Animations             | 🔥     | Medium | P2       |
| 13  | FAQ Block              | 🔥🔥   | Low    | P2       |
| 14  | Version History        | 🔥🔥   | Medium | P2       |
| 15  | Global Header/Footer   | 🔥🔥   | Medium | P2       |
| 16  | Multi-Page Sites       | 🔥🔥   | High   | P2       |
| 17  | Integrations/Embed     | 🔥🔥   | Medium | P2       |
| 18  | Blog Integration       | 🔥     | Low    | P2       |
| 19  | AI Copy Assistant      | 🔥🔥   | Medium | P3       |
| 20  | Component Marketplace  | 🔥     | High   | P3       |
| 21  | Collaborative Editing  | 🔥     | High   | P3       |
| 22  | Performance Score      | 🔥     | Medium | P3       |
| 23  | Multi-Language         | 🔥     | High   | P3       |
| 24  | Conversion Funnels     | 🔥🔥   | High   | P3       |
