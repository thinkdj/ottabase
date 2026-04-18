# @ottabase/homepage-contract

Shared Zod contract package for homepage, marketing page, and navigation payloads.

## Purpose

`@ottabase/homepage-contract` is the payload contract layer for homepage-style content.

It exists to keep producers and consumers aligned on the same data shape for:

- homepage sections
- marketing/content pages
- page navigation lists
- display metadata such as slot variants, theme preset ids, and SEO fields

Right now, this package is a schema package, not a runtime rendering or theming package.

## How It Works Now

The current implementation is straightforward:

1. A producer returns homepage or page JSON.
2. A consumer imports schemas from `@ottabase/homepage-contract`.
3. The consumer validates the payload with Zod.
4. The validated payload is then mapped into UI components, routing, or rendering logic.

The current package surface is the built output in `dist/`.

## What This Package Covers

The current build exports schemas for four main areas.

### 1. Homepage payloads

These cover the main homepage response shape.

- `FeatureSchema`
- `ActionSchema`
- `SectionSchema`
- `DisplaySchema`
- `ExposedPageSchema`
- `HomepageDataSchema`

`HomepageDataSchema` currently models:

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

Homepage display config currently supports:

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

`PageDataSchema` currently models:

- `page`
- `sections`
- `display`
- `content`

Page metadata currently includes fields such as:

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

This currently models a `pages` array containing summary fields like:

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

## Current Usage Pattern

Use this package when a producer and consumer need to agree on homepage or page JSON.

Example:

```typescript
import { HomepageDataSchema, PageDataSchema, PagesListSchema, NavPagesSchema } from '@ottabase/homepage-contract';

const homepagePayload = HomepageDataSchema.parse(json);
const pagePayload = PageDataSchema.parse(json);
const pagesListPayload = PagesListSchema.parse(json);
const navPayload = NavPagesSchema.parse(json);
```

This gives you one place to validate the payload contract before rendering.

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

- this package is a shared Zod contract layer
- it documents homepage/page payload structure, not UI behavior
- the Next.js homepage app handles brand theming directly through brand-engine
- the package is best understood as content-contract infrastructure, separate from the brand runtime
