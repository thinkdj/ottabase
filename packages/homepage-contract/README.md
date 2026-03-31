# @ottabase/homepage-contract

Shared Zod schemas and TypeScript types for the homepage data API contract between the TanStack worker (producer) and
the Next.js homepage app (consumer).

## Usage

```typescript
import {
    HomepageDataSchema,
    type HomepageDataPayload,
    type HomepageSectionPayload,
    type ExposedPage,
} from '@ottabase/homepage-contract';

// Validate an API response
const result = HomepageDataSchema.safeParse(apiResponse);
if (result.success) {
    const data: HomepageDataPayload = result.data;
}

// Type-safe section access
const hero: HomepageSectionPayload | undefined = data.sections.find((s) => s.slot === 'hero');
```

## Exported Schemas

| Schema               | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `ExposedPageSchema`  | `{ slug, title }` for navbar page links               |
| `FeatureSchema`      | Feature item with icon, imageUrl, href                |
| `ActionSchema`       | Action button with variant, icon, external            |
| `SectionSchema`      | Full section with nested features + actions           |
| `DisplaySchema`      | Variant-by-slot, theme, SEO, custom CSS               |
| `HomepageDataSchema` | Top-level payload (sections + display + exposedPages) |

## Exported Types

All types are inferred from Zod schemas (`z.infer<typeof Schema>`) — zero drift.
