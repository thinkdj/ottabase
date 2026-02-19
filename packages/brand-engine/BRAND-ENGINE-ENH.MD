# Brand Kit Review

## What's Well-Designed

The architecture has strong foundations:

- **Clean separation:** brand-engine (pure logic, no React) vs brand-engine-react (bindings) is the right call.
  Framework-agnostic core means you could add Vue/Svelte adapters later.
- **Three-table schema** (brand_kits, layout_templates, layout_route_mappings) is normalized and clean. Route mappings
  with priority-based matching and glob patterns (\*, \*\*) is genuinely flexible.
- **Resolution pipeline** is well-layered: preset → tenant overrides → mode selection → alias resolution → defaults.
  Each step has a clear job.
- **Client-side route resolution** (single fetch of FullBrandConfig, then resolve per-path locally) avoids waterfall
  requests on navigation. The regex + result caching in createRouteMatcherCache is correct.
- **Semantic design tokens** aligned with shadcn/ui conventions means zero friction with the existing UI layer.

## Where It Falls Short (and How to Fix It)

### 1. No Brand Kit Inheritance — The Biggest Gap for Multi-Tenant

Right now each BrandKit is a standalone island. If Org A has 5 apps that share 90% of their branding but differ in
primary color, you need 5 independent kits. Clone creates a copy, not a link — so updating the shared typography means
touching all 5.

**What I'd add:** A `parentBrandKitId` column on brand_kits. Resolution becomes:

> system default → org kit → app kit (each layer only stores its overrides)

The resolver already does `deepMerge(base, tenantOverrides)` — extend this to walk the parent chain. This is the single
change that would unlock real multi-tenant theming at scale. Without it, every org admin maintaining 10+ apps will be
doing manual copy-paste.

**Schema change:**

```sql
ALTER TABLE brand_kits ADD COLUMN parent_brand_kit_id TEXT REFERENCES brand_kits(id);
```

**Resolution change in resolveBrandConfig.ts:** before calling `brandKitToTheme()`, walk up the parent chain and
deep-merge each layer's `tokensJson`.

### 2. Route Mappings Can't Override Individual Tokens

Currently a route mapping points to a whole brand kit. If `/marketing/**` needs different colors but the same
fonts/logos as the org kit, you need a separate brand kit with duplicated data.

**What I'd add:** An optional `tokenOverridesJson` column on layout_route_mappings. During resolution, after resolving
the brand kit, apply the route-level overrides:

```typescript
// In resolveConfigForPath:
const kit = brandKitsMap[match.brandKitId];
const routeOverrides = match.tokenOverrides; // new field
const theme = routeOverrides ? resolveTheme({ base: kit.theme, tenantOverrides: routeOverrides, mode }) : kit.theme;
```

This gives you per-route token tweaks without brand kit proliferation.

### 3. Cache Invalidation Is Passive Only

The KV cache has a 1-hour TTL (persistence/cache.ts). When an admin saves brand changes, users see stale branding for up
to 60 minutes. For a "design layer" product, this is a poor experience.

**What I'd add:**

- **Active cache purge on write.** Every `handleUpdateBrandKit` / `handleCreateBrandKit` handler should call
  `cache.invalidate(appId)` for both light and dark modes.
- **A version or etag field** on brand kits. The client sends `If-None-Match` on `/api/brand` requests, and the server
  returns 304 when unchanged. This lets you drop the TTL to something much shorter (or use stale-while-revalidate)
  without hammering the DB.
- Consider **Cloudflare Durable Objects** or **WebSocket push** for real-time brand updates in the admin preview flow.

### 4. No Draft/Publish Workflow

Brand kit edits are live immediately. There's no way for an admin to preview changes across routes before publishing.

**What I'd add:**

- A `status` column: `draft | published | archived`.
- Route mappings resolve against published kits only. Draft kits are visible only in the admin preview (which already
  exists in previewTheme.ts).
- Optional: a `publishedAt` timestamp and a `publishedTokensJson` snapshot, so the live version is frozen while the
  admin iterates on the draft.

This is table stakes for any design system used in production.

### 5. Color Scheme Is Binary (light/dark)

`DesignTokens.color` only has `light` and `dark` keys. No room for high-contrast, colorblind-safe, or custom
user-defined schemes.

**What I'd change:** Make `color` a `Record<string, TokenColors>` instead of
`{ light: TokenColors; dark: TokenColors }`:

```typescript
color: {
  light: TokenColors;
  dark: TokenColors;
  'high-contrast'?: TokenColors;
  'colorblind-deuteranopia'?: TokenColors;
  [custom: string]: TokenColors | undefined;
}
```

The resolver already takes a `mode` string — it just needs to look up `merged.tokens.color[mode]` (which it already does
at resolver.ts:124). The only change is the type definition and adding a fallback chain: requested mode → light →
defaults.

### 6. Layout System Is a Fixed Slot Machine

`LayoutConfig` has exactly 5 fields: `header`, `navigation`, `contentWidth`, `footer`, `density`. You can't add a
sidebar-right, a breadcrumb slot, a sub-navigation zone, or any layout region that wasn't anticipated.

**What I'd add:** A `zones` or `slots` extension map:

```typescript
interface LayoutConfig {
    header: HeaderVariant;
    navigation: NavigationVariant;
    contentWidth: ContentWidth;
    footer: boolean;
    density: Density;
    // Extensible slot overrides
    slots?: Record<
        string,
        {
            component?: string; // registered component key
            visible?: boolean;
            position?: string; // e.g., 'before-content', 'after-sidebar'
            config?: Record<string, unknown>;
        }
    >;
}
```

This keeps the simple defaults working while allowing power users to inject arbitrary layout regions. The
ConfigurableLayout component would iterate over slots and render registered components.

### 7. Full Config Payload Will Not Scale

`resolveFullBrandConfig` returns all brand kits for the org. If an org has 50 brand kits (one per client in a
white-label scenario), the initial payload becomes large. Each kit includes a full ResolvedBrandTheme with all token
categories.

**What I'd optimize:**

- Only send kits referenced by active route mappings (you partially do this via brandKitIds extraction, but the compact
  form always sends everything).
- Deduplicate: if multiple routes reference the same kit, it's only serialized once (already happening via brandKitsMap
  — good).
- Compress the wire format: strip default values that match the preset, send only deltas. The client reconstructs the
  full theme from themeBase + delta.
- For the extreme case: lazy-load brand kits. On first navigation, fetch only the kit for the current route. Prefetch
  others in the background.

### 8. No Programmatic Token Access from JS

CSS variables work for styling, but if application code needs token values (chart libraries, canvas rendering, dynamic
SVG generation), there's no clean API. You'd have to
`getComputedStyle(document.documentElement).getPropertyValue('--primary')`.

**What I'd add:** A `useTokens()` hook:

```typescript
function useTokens() {
    const { config } = useBrand();
    return config?.theme; // ResolvedBrandTheme with typed access
}

// Usage:
const tokens = useTokens();
const chartColor = tokens.colors.primary; // HSL string, ready for chart libs
```

This is trivial to implement — the data is already in context. Just expose it with a clean API.

### 9. Font Loading Strategy Is Naive

In css-runtime.ts, fonts are injected as `<link>` tags to Google Fonts. No font-display control, no preloading, no
self-hosted font support beyond raw URLs. This causes FOUT/FOIT issues.

**What I'd improve:**

- Add `fontDisplay` to `TokenTypography`: `'swap' | 'block' | 'fallback' | 'optional'` (default `'swap'`).
- Generate `@font-face` declarations instead of (or in addition to) Google Fonts `<link>` tags, so self-hosted fonts and
  R2-hosted fonts work identically.
- Add `<link rel="preload" as="font">` for the heading and body fonts in the critical path.
- Consider using the **Font Loading API** (`document.fonts.load()`) to detect when fonts are ready and avoid layout
  shift.

### 10. Custom CSS Is a Maintenance Trap

The `customCss` field on brand kits is validated for syntax but not scoped. An admin's custom CSS can break the entire
app. There's no sandboxing, no specificity control, and no way to know what the CSS targets.

**What I'd improve:**

- Scope custom CSS under a `.brand-custom` class or use CSS `@layer` to control specificity:
    ```css
    @layer brand-custom {
        /* admin CSS injected here */
    }
    ```
- Provide a structured "overrides" interface for common customizations (border-width, button-radius, link-underline)
  instead of raw CSS. Raw CSS becomes the escape hatch, not the primary tool.
- Add a size limit and a lint pass (e.g., reject `position: fixed`, `z-index > 9999`, `@import`).

### 11. Missing: Audit Trail for Brand Changes

You have `createdBy`/`updatedBy` but no history. When someone breaks the brand, there's no way to see what changed or
revert.

**What I'd add:** Use your existing `@ottabase/audit` package. Log every brand kit mutation with before/after snapshots
of `tokensJson`. This pairs with the draft/publish workflow — you get a timeline of published versions.

### 12. The mode Detection in BrandProvider Is Fragile

BrandProvider.tsx:258-260:

```typescript
const mode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';
```

This reads the DOM class at fetch time. If the user toggles dark mode after the initial fetch, the FullBrandConfig still
has the old mode's resolved themes. The BrandThemeApplicator re-resolves client-side (good), but the server-resolved
theme in brandKitsMap is stale for the new mode.

**What I'd fix:** Fetch the config without mode-specific resolution. Send both light and dark color palettes in
brandKitsMap. Let the client pick the palette based on current mode. This eliminates the need to refetch on mode toggle
and removes the DOM-sniffing hack.

## Priority Ranking

If I were implementing these, this is the order I'd tackle:

| Priority | Change                                     | Impact                                 |
| -------- | ------------------------------------------ | -------------------------------------- |
| P0       | Brand kit inheritance (parentBrandKitId)   | Unlocks real multi-tenant at scale     |
| P0       | Active cache invalidation on write         | Admin changes must go live immediately |
| P1       | Draft/publish workflow                     | Production safety                      |
| P1       | Mode-agnostic payload (send both palettes) | Eliminates stale mode bug              |
| P1       | useTokens() hook                           | Trivial to add, high utility           |
| P2       | Route-level token overrides                | Reduces kit proliferation              |
| P2       | Extensible color schemes                   | Accessibility                          |
| P2       | Audit trail integration                    | Operational safety                     |
| P3       | Layout slots system                        | Power-user flexibility                 |
| P3       | Font loading improvements                  | UX polish                              |
| P3       | Custom CSS scoping                         | Admin guardrails                       |
| P3       | Payload optimization                       | Scale concern, not urgent yet          |

## Conclusion

The core architecture is solid. The main gap is that it's built for "one org, one kit" simplicity but marketed for
"multi-tenant, per-route, per-org" flexibility. The inheritance chain and route-level overrides are what bridge that
gap. Everything else is polish.

## TO ENSURE (brand-engine, ottalayout and their deep integration into tanstack template app)

- Only one default brand kit per org
- Inherited Brand Kits have enable/disable for each section and it saves only the diff.
- Layouts and routes are configurable
- User can save and/or delete route maps
- If NO route maps are present, use `/**` with Default Brand Kit and app-shell layout as fallback
- ottalayout and brand-engine packages are decoupled but work seamlessly together in the template app
- ottalayout and brand-engine have no React or UI dependencies and can be used in any framework with the appropriate
  bindings
