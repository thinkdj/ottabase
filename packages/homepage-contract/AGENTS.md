# @ottabase/homepage-contract — agent notes

Zod payload contracts for homepage, marketing page, page-list, and nav JSON. Full docs: ./README.md

## Use when

- A producer and consumer must agree on homepage/page/page-list/nav payload shapes; `.parse` before rendering.
- NOT for theming: brand kits, CSS variables, SSR themes, `BrandProvider` — use `@ottabase/brand-engine` / `@ottabase/brand-engine-react`.

## Canonical usage

    import { HomepageDataSchema, PageDataSchema, PagesListSchema, NavPagesSchema } from '@ottabase/homepage-contract';

    const homepage = HomepageDataSchema.parse(json);

## Gotchas

- Repo contains only README.md — no package.json, src, or dist. All exports (also `SectionSchema`, `DisplaySchema`, `FeatureSchema`, `ActionSchema`, `ExposedPageSchema`, `PageSectionSchema`, `PageMetaSchema`, `NavPageSchema`, ...) are README-documented, not source-verified.
- Schema-only: no rendering, theme resolution, or brand runtime.
- The Next.js homepage app themes via brand-engine directly, bypassing this package.
