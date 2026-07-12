# @ottabase/utils — agent notes

Tree-shakeable generic helpers: strings, URLs, dates/timezones, currency, email, JSON, HTTP responses, pagination, sanitization. Full docs: ./README.md

## Use when

-   You need a generic helper (validation, formatting, timezone math, pagination responses, env/browser detection) — check here before writing one.
-   Sanitizing any user-supplied HTML/URL/SVG/CSS/JSON-in-script (house rule: always via `@ottabase/utils/sanitize`).
-   NOT for domain/business logic, DB, auth, or rendering — those live in dedicated packages.

## Imports

```ts
import { isEmail, changeCase, getInitials, generateUUID, ucFirst } from '@ottabase/utils/string';
import { makeSlug, getDomainName, joinPaths, isValidUrl } from '@ottabase/utils/url';
import { toUTC, fromUTC, formatInUserTimezone, nowUTC, isValidTimezone } from '@ottabase/utils/timezone';
import { sanitizeUrl, sanitizeInlineHtml, sanitizeBlockHtml, sanitizeSvgHtml } from '@ottabase/utils/sanitize';
import { ServiceError, errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { parsePaginationParams, createPaginatedResponse } from '@ottabase/utils/pagination';
```

Other subpaths: `/file`, `/env`, `/currency`, `/email`, `/email-gmail`, `/json`, `/user`, `/git`, `/browser`. Root barrel re-exports everything EXCEPT `sanitize` — prefer subpaths for tree-shaking.

## Canonical usage

```ts
// API route error/success (house pattern)
try {
    return jsonResponse({ ok: true });
} catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.message, e.status, e.toApiResponse());
    return errorResponse('Something went wrong', 500);
}

const { page, perPage, orderBy, order, search } = parsePaginationParams(url.searchParams);
return jsonResponse(createPaginatedResponse({ data, total, page, perPage, path: '/api/items' }));
// User HTML/URLs: sanitizeInlineHtml(userInput), sanitizeBlockHtml(...), sanitizeUrl(...)
```

## Gotchas

-   `sanitize` is intentionally NOT in the root barrel; import `@ottabase/utils/sanitize` directly. Uses dompurify (needs jsdom in Node/SSR).
-   `file`, `git`, `env` are Node-only; `browser` is client-only; root import mixes both — avoid it in edge runtime (no Node-only APIs).
-   `react` is a peerDependency; depend on this package via `workspace:*`.
