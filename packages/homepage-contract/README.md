# @ottabase/homepage-contract

Shared **Zod** schemas and **TypeScript** types for the marketing homepage public API (`GET /api/homepage/data`).

- **Version 1** payload: `HomepagePublicPayloadV1` (`version: 1`, `themePresetId`, `variantBySlot`, `slots`,
  `exposedPages`).
- **`exposedPages`**: `{ slug, title }[]` — published Ottablog marketing pages (`contentType: page`,
  `exposeToHomepage: true`) for the Next.js navbar.
- **Slots** are strongly typed: `navbar`, `hero`, `features`, `cta`, `footer`, `about`.
- **Features** are `items[]` with `{ id, title, description, icon? }`.
- **Build**: `buildHomepagePublicPayloadV1(sections, display, fallbackThemePresetId)` — used by the TanStack worker.
- **Parse**: `parseHomepagePublicPayloadV1(json)` / `safeParseHomepagePublicPayloadV1(json)` — used by the Next.js app.
- **Slot variants**: `homepageSlotVariantRegistry` and `getHomepageVariantIdsForSlot(slot)` — aligned with the Next.js
  `SLOT_REGISTRY` (theme/variant pickers in TanStack admin).

## Example

```typescript
import { buildHomepagePublicPayloadV1, parseHomepagePublicPayloadV1 } from '@ottabase/homepage-contract';

const payload = buildHomepagePublicPayloadV1(dbSections, displaySettings, 'crisp');
const parsed = parseHomepagePublicPayloadV1(await res.json());
```
