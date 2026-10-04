# Start here

Ottabase is a Cloudflare-native foundation for SaaS apps, products and content sites. Auth, organizations and roles, an
ORM over D1, forms, uploads, a blog/CMS, queues and a runtime theming engine are already wired together, so you can
start on the product itself.

## Run it locally

```bash
pnpm install
pnpm build:pkg   # build the workspace packages once
pnpm dev         # Vite frontend + Wrangler backend
```

The full five-minute walkthrough (prerequisites, first admin, database init) is in `QUICKSTART.md` at the repo root.

## Try it before you read

- [Demo gallery](/demo): every package as a hands-on page. The [fuzzy date playground](/demo/ottadate) shows the style.
- Press Ctrl+K (⌘K on a Mac) anywhere to jump to any page.

## Pick your next step

**Build a product**

- [Solo Founder's SaaS Platform Guide](/docs/guides/solo-founder-saas-guide): the end-to-end path from idea to paying
  users.
- [Recommended · Supported · Possible](/docs/guides/recommended-supported-possible): what to reach for first, and what
  is merely possible.
- [Package Creation Guide](/docs/guides/package-creation-guide): add your own feature as a workspace package.

**Users, teams and access**

- [Multi-Tenant RBAC System](/docs/guides/rbac-multi-tenant-guide): organizations, roles, permissions and tenant
  isolation.
- [Referral system](/docs/guides/referral-system)
- [Premium Packages](/docs/guides/premium-packages): ship paid add-ons with offline licensing.

**Content**

- [Blog-Only Public Surface](/docs/guides/blog-public-surface): run Ottabase as a blog or content site.

**Ship and operate on Cloudflare**

- [Deploy to Cloudflare Workers](/docs/guides/cloudflare-deploy)
- [Cloudflare Configuration Guide](/docs/guides/cloudflare-configuration-guide) and the
  [Cloudflare Features Guide](/docs/guides/cloudflare-features)
- [Cache Key Prefixing System](/docs/guides/cache-keys)

**Conventions**

- [API Pagination Standard](/docs/guides/api-pagination)
- [Timezone Standardization Guide](/docs/guides/timezone-guide)
- [Testing Guide](/docs/guides/testing)
- [Releases](/docs/guides/releases)

Every package also has its own page under **Packages** in the sidebar.
