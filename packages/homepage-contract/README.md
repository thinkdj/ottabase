# @ottabase/homepage-contract

Shared Zod contract package for homepage, marketing page, and navigation payloads.

> **Status: design proposal, not yet implemented.** This directory currently contains only this README — there is no
> `package.json`, `src/`, or built `dist/` output, and the package is not published or installable. It does not appear
> as a dependency anywhere else in this monorepo (including in `apps/otta-landing`, which references it only
> descriptively). Everything below describes the intended schema contract, not a shipped package — treat it as a spec
> to implement against, not a usable import today.

## Purpose

`@ottabase/homepage-contract` is the payload contract layer for homepage-style content.

It exists to keep producers and consumers aligned on the same data shape for:

- homepage sections
- marketing/content pages
- page navigation lists
- display metadata such as slot variants, theme preset ids, and SEO fields

Right now, this package is a schema package, not a runtime rendering or theming package.

## How It Would Work

The intended usage is straightforward:

1. A producer returns homepage or page JSON.
2. A consumer imports schemas from `@ottabase/homepage-contract`.
3. The consumer validates the payload with Zod.
4. The validated payload is then mapped into UI components, routing, or rendering logic.

Once implemented, the package surface would be the built output in `dist/`, following the same pattern as every
other package in this monorepo.

## What This Package Covers

The design covers schemas for four main areas.

### 1. Homepage payloads

These cover the main homepage response shape.

- `FeatureSchema`
- `ActionSchema`
- `SectionSchema`
- `DisplaySchema`
- `ExposedPageSchema`
- `HomepageDataSchema`

`HomepageDataSchema` is designed to model:

- `sections`
- `display`
- `exposedPages`

Homepage sections support fields such as:

- `id`
- `slot`
- `title`
- `subtitle`
- `body`
- `githubUrl`
- `icon`
- `enabled`
- `cssClasses`
- `metadata`
- `sortOrder`
- `features`
- `actions`

Homepage display config is designed to support:

- `variantBySlot`
- `themePreset`
- `fallbackThemePresetId`
- `customCss`
- `seoTitle`
- `seoDescription`

### 2. Page payloads

These cover individual marketing or content pages.

- `PageFeatureSchema`
- `PageActionSchema`
- `PageSectionSchema`
- `PageDisplaySchema`
- `PageMetaSchema`
- `PageContentSchema`
- `PageDataSchema`

`PageDataSchema` is designed to model:

- `page`
- `sections`
- `display`
- `content`

Page metadata is designed to include fields such as:

- `id`
- `slug`
- `title`
- `type`
- `status`
- `showInNav`
- `navOrder`
- `navLabel`
- `icon`

### 3. Page list payloads

These cover list endpoints and admin-style page indexes.

- `PagesListSchema`

This is designed to model a `pages` array containing summary fields like:

- `id`
- `slug`
- `title`
- `type`
- `status`
- `showInNav`
- `navOrder`
- `createdAt`
- `updatedAt`

### 4. Navigation payloads

These cover lightweight page data for navigation rendering.

- `NavPageSchema`
- `NavPagesSchema`

## What This Package Does Not Do

This package does not perform rendering, theme resolution, or runtime brand application.

It should not be used for:

- brand kit resolution
- CSS variable injection
- SSR theme generation
- `BrandProvider` setup
- route-aware brand layout resolution

## Relationship To Brand Engine

`@ottabase/homepage-contract` and `@ottabase/brand-engine` solve different problems.

- `@ottabase/homepage-contract` defines the shape of homepage and page content payloads.
- `@ottabase/brand-engine` resolves tokens, themes, CSS variables, and brand configuration.
- `@ottabase/brand-engine-react` provides React bindings such as `BrandProvider`.

They can be used together, but they are not the same layer.

## Relationship To The Next.js Homepage App

The current Next.js homepage app uses brand-engine directly for theming.

Today, that app:

- depends directly on `@ottabase/brand-engine`
- depends directly on `@ottabase/brand-engine-react`
- builds SSR brand config inside the app
- applies critical CSS and runtime theme changes without routing that through `@ottabase/homepage-contract`

So the current boundary is:

- `homepage-contract` is for homepage/page data shape
- `brand-engine` is for theme and brand behavior

## Intended Usage Pattern

Use this package when a producer and consumer need to agree on homepage or page JSON.

Example (illustrative — the package is not implemented yet, so this is not runnable today):

```typescript
import { HomepageDataSchema, PageDataSchema, PagesListSchema, NavPagesSchema } from '@ottabase/homepage-contract';

const homepagePayload = HomepageDataSchema.parse(json);
const pagePayload = PageDataSchema.parse(json);
const pagesListPayload = PagesListSchema.parse(json);
const navPayload = NavPagesSchema.parse(json);
```

Once built, this would give you one place to validate the payload contract before rendering.

## Practical Scope

Use `@ottabase/homepage-contract` for:

- validating homepage API responses
- validating marketing page API responses
- validating navigation payloads
- keeping producer and consumer payload shapes synchronized

Do not use it for:

- theme preset expansion
- brand token resolution
- live theme switching
- dark mode application
- `BrandProvider` integration

## Current State Summary

As the repo stands now:

- this package is a design proposal for a shared Zod contract layer — there is no `package.json`, source, or build,
  and it cannot be installed or imported
- the schemas above document an intended homepage/page payload structure, not an implemented one
- the Next.js homepage app handles brand theming directly through brand-engine, with no dependency on this package
- if and when it is implemented, this package should remain content-contract infrastructure, separate from the brand
  runtime
