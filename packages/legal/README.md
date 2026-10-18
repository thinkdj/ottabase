# @ottabase/legal

**Parameterized, conditional legal pages for SaaS apps.** One config produces Terms of Service, Privacy Policy (GDPR and
CCPA clauses fold in), Cookie Policy, Acceptable Use Policy, Refund and Cancellation Policy and a Sub-processors list.
Clauses switch on and off per app, every `{{variable}}` is interpolated, any section can be overridden, and the result
is served from the Worker, rendered in React, or both from the same config.

> **Not legal advice.** The templates are written in the conventional form and cover what these documents usually must,
> but they are a starting point. Have counsel review the result, especially jurisdiction, refunds, retention and the
> data practices described, before you publish.

```
LegalConfig (names, contact, jurisdiction, dates, feature flags, sub-processors, overrides)
        │
        ▼   drop clauses that do not apply → fill {{vars}} → apply overrides
assembleLegalDocument()  ──►  Markdown + title + TOC + copyright
        │                              │
        ▼                              ▼
createLegalPackage()            <LegalDocument />
Worker routes: HTML, .md, .json   React, from @ottabase/legal/react
```

## What you get

| Document                | Slug             | Published when                       |
| ----------------------- | ---------------- | ------------------------------------ |
| Terms of Service        | `terms`          | always                               |
| Privacy Policy          | `privacy`        | always                               |
| Acceptable Use Policy   | `acceptable-use` | always                               |
| Cookie Policy           | `cookies`        | `features.cookies`                   |
| Refund and Cancellation | `refunds`        | `features.paidPlans`                 |
| Sub-processors          | `subprocessors`  | `subProcessors` set or `features.eu` |

Within a document, clauses toggle too. The Terms carry billing, trial, lifetime, user content, organizations, API, AI
and data protection clauses only when the matching flag is on. The Privacy Policy folds in GDPR legal bases, transfers
and the right to complain (`eu`), California rights (`california`), AI processing (`ai`), cookies, analytics, email and
payment data. The Refund policy switches to a no-refund text that preserves statutory rights at `refundWindowDays: 0`.

## Quickstart in an Ottabase app

One config file, read by the Worker and the SPA:

```ts
// ottabase/legal.config.ts
import { legalConfigFromApp } from '@ottabase/legal';
import ottabaseConfig from './ottabase.config';

export const legalConfig = legalConfigFromApp(ottabaseConfig, {
    siteUrl: 'https://acme.com',
    jurisdiction: 'the State of Delaware, United States',
    companyAddress: '1 Main Street, Wilmington, DE 19801, United States',
    lastUpdated: { terms: '1 May 2026', privacy: '1 May 2026', 'acceptable-use': '1 May 2026', refunds: '1 May 2026' },
    features: { paidPlans: true, userContent: true, ai: true, cookies: true, eu: true, california: true },
    subProcessors: [
        {
            name: 'Cloudflare, Inc.',
            purpose: 'Hosting and edge compute',
            location: 'Global',
            url: 'https://www.cloudflare.com/trust-hub/gdpr/',
        },
    ],
});
```

`legalConfigFromApp` takes the app name, the company name and the contact email (parsed from `email.from`) from the app
config; you state the rest.

Register the package once in `ottabase/packages.ts` (or `otta add legal`):

```ts
// ottabase/packages/legal.ts
import { createLegalPackage } from '@ottabase/legal';
import { legalConfig } from '../legal.config';

// A server-rendered app or a landing site: full HTML pages at /legal/*.
export const legalPackage = createLegalPackage<CloudflareEnv>({ config: legalConfig });

// A SPA that renders the pages itself: JSON and Markdown beside it, at /api/legal/*.
export const legalPackage = createLegalPackage<CloudflareEnv>({
    config: legalConfig,
    basePath: '/api/legal',
    serve: 'api',
});
```

Routes, in either mode:

| Route                    | Returns                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `GET {base}`             | the index: HTML page, or the JSON list when `serve: 'api'`          |
| `GET {base}/{slug}`      | the document: HTML page, or JSON when `serve: 'api'`                |
| `GET {base}/{slug}.html` | always the HTML page                                                |
| `GET {base}/{slug}.md`   | always Markdown                                                     |
| `GET {base}/{slug}.json` | always `{ id, slug, title, lastUpdated, markdown, toc, copyright }` |
| `GET {base}/index.json`  | always the JSON list of published documents                         |

A disabled or unknown document falls through to the next handler, so the SPA or your 404 page answers. Responses carry
`Cache-Control: public, max-age=3600` (`maxAge` changes it). The health probe `legal:config` reports every gap from
`validateLegalConfig` to the fleet, so a placeholder jurisdiction never reaches production unnoticed.

Render in the SPA from the same config:

```tsx
import { LegalDocument, LegalIndex } from '@ottabase/legal/react';
import '@ottabase/legal/styles.css';
import { resolveLegalSlug } from '@ottabase/legal';

const docId = resolveLegalSlug(slug, legalConfig);
return docId ? <LegalDocument docId={docId} config={legalConfig} /> : <LegalIndex config={legalConfig} />;
```

## Config reference

| Field              | Required | Notes, and the `{{var}}` it fills                                                                                                                       |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `appName`          | ✓        | Product name `{{appName}}`                                                                                                                              |
| `companyName`      | ✓        | Legal entity `{{companyName}}`                                                                                                                          |
| `siteUrl`          | ✓        | `https://...` `{{siteUrl}}`                                                                                                                             |
| `contactEmail`     | ✓        | `{{contactEmail}}`                                                                                                                                      |
| `jurisdiction`     | ✓        | Courts and venue `{{jurisdiction}}`                                                                                                                     |
| `lastUpdated`      | ✓        | One string, or `{ [docId]: date }` (recommended) `{{lastUpdated}}`                                                                                      |
| `privacyEmail`     |          | Defaults to `contactEmail` `{{privacyEmail}}`                                                                                                           |
| `companyAddress`   |          | Controller address, required in practice for EU/UK users `{{companyAddress}}`                                                                           |
| `governingLaw`     |          | Defaults to `jurisdiction` `{{governingLaw}}`                                                                                                           |
| `basePath`         |          | Where the pages live, default `/legal`; cross-document links use it `{{legalBase}}`                                                                     |
| `copyrightYear`    |          | Defaults to the current year `{{copyrightYear}}`                                                                                                        |
| `refundWindowDays` |          | Default 14; `0` publishes a no-refund policy `{{refundWindowDays}}`                                                                                     |
| `minimumAge`       |          | Minimum age to hold an account; unset means "old enough to form a contract" `{{minimumAge}}`                                                            |
| `noticeDays`       |          | Notice before price changes and material changes to the terms, default 30 `{{noticeDays}}`                                                              |
| `deletionDays`     |          | Days after account deletion within which data is removed, default 30 `{{deletionDays}}`                                                                 |
| `features`         |          | `paidPlans`, `freeTrial`, `lifetimePlans`, `userContent`, `organizations`, `api`, `ai`, `cookies`, `analytics`, `email`, `children`, `eu`, `california` |
| `subProcessors`    |          | `{ name, purpose, location?, url? }[]`, rendered through `{{subProcessorList}}`                                                                         |
| `overrides`        |          | Per document: `prepend`, `append`, `replace: { [sectionId]: {...} }`, `remove: [sectionId]`                                                             |
| `extraVars`        |          | Extra `{{placeholders}}` for your override sections                                                                                                     |

Section ids are stable and documented in `src/templates/*.ts`. Overrides run remove, then replace, then prepend and
append, before `when` conditions are applied, so an override section may carry its own `when`.

## Headless and rendered

- `@ottabase/legal` is headless: types, `assembleLegalDocument`, `listLegalDocuments`, `resolveLegalSlug`, the Markdown
  and HTML renderers, `legalConfigFromApp`, `validateLegalConfig` and `createLegalPackage`.
- `@ottabase/legal/react` has `LegalDocument`, `LegalIndex` and `LegalMarkdown`. Import `@ottabase/legal/styles.css`
  once; the styles read the app's shadcn or Brand Kit variables and fall back to neutral ones.

Both renderers understand the same Markdown subset the templates use and produce the same heading anchors, so a table of
contents built on the server matches a page rendered on the client. Neither uses `innerHTML`; a link is kept only when
its address is relative, an anchor, `https://`, `http://` or `mailto:`.

## Validation

```ts
import { validateLegalConfig } from '@ottabase/legal';
const gaps = validateLegalConfig(legalConfig); // [] when complete for what it publishes
```

It checks the shape, not the law: an https `siteUrl`, real email addresses, a jurisdiction that is not a placeholder, a
date for every published document, a controller address and sub-processors when `eu` is on, AI providers listed when
`ai` is on, and whole-number day counts.
