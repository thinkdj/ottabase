# @ottabase/og

Social images for any page: the 1200 by 630 card that X, LinkedIn, Slack and iMessage show when a link is shared. The
card is an HTML page drawn by Cloudflare Browser Rendering, kept in R2 so each card costs one browser session, and
served from a URL the app signs, so the public route renders what the app asked for and nothing else.

Headless: no React, no admin page. The template is a function from a card to HTML; the default one is here, and Ottabase
Pro's og-studio edits one visually. otta-web uses it for every blog post without a hero image.

## The card

```ts
{
    title: 'Why we moved to D1',       // required, up to 200 characters
    subtitle: 'Four months, no regrets', // up to 300
    eyebrow: 'Engineering',            // the small line above the title
    siteName: 'Acme', domain: 'acme.dev',
    author: 'Sam', date: 'Oct 2026',
    accent: '#16a34a', background: '#0b1220', theme: 'dark',
    imageUrl: 'https://…/hero.jpg',    // drawn behind the text, shaded
    logoUrl: 'https://…/logo.svg',     // in the footer
}
```

Every field is bounded (`CARD_LIMITS`), colors must be `#rrggbb`, images must be http(s). Fields the route fills from
its `defaults` (site name, domain, colors, logo) can be left out of a URL, which keeps the URL short and lets the brand
change without every emitted URL changing with it.

## Install

```ts
// ottabase/packages/og.ts
import { createOgPackage } from '@ottabase/og';

export const ogPackage = createOgPackage<CloudflareEnv>({
    getBrowserBinding: (env) => env.OBCF_BROWSER,
    getBucket: (env) => env.OBCF_R2,
    secret: (env) => env.AUTH_SECRET,
    defaults: (env, request) => ({ siteName: 'Acme', domain: new URL(request.url).host, accent: '#16a34a' }),
});
```

Then, wherever the app writes a page's `<head>`:

```ts
import { ogImageUrl } from '@ottabase/og';

const image = await ogImageUrl(origin, { title, subtitle: excerpt, eyebrow: 'Blog', author }, env.AUTH_SECRET);
// <meta property="og:image" content={image}>  <meta name="twitter:card" content="summary_large_image">
```

Options: `template` and `version` (another look; the version is part of the cache key, so name a new one when the
template changes), `templates` (a source that picks a template per request, as og-studio does; a package can also
`registerOgTemplateSource()` without the app wiring it), `prefix` (`og/` in the bucket), `open` (serve unsigned URLs:
local development, or an app that accepts the cost), `maxAge` (one day), `basePath` (`/api/og`).

Without Browser Rendering the routes answer 503 and the health line says so. Without a bucket every request renders.

## Routes

| Route                               | Who    | Does                                                                       |
| ----------------------------------- | ------ | -------------------------------------------------------------------------- |
| `GET /api/og/image?title=…&sig=…`   | anyone | the PNG, `Cache-Control: public, max-age=86400`; 403 without the signature |
| `GET /api/og/preview?title=…&sig=…` | anyone | the same card as HTML, to look at the template                             |

The signature is HMAC-SHA256 of the card's canonical query string under the secret. 400 for a bad card, 503 when
rendering is not configured, 502 when the browser failed.

## Your own template

```ts
import { createOgPackage, escapeHtml, type OgTemplate } from '@ottabase/og';

const template: OgTemplate = (card) => `<!doctype html><body style="width:1200px;height:630px">
    <h1>${escapeHtml(card.title)}</h1></body>`;

createOgPackage({ …, template, version: 'acme-2' });
```

`createOgTemplate({ fontCss, fontFamily })` is the default look with a web font. The default template escapes every
field and only draws http(s) images.

## Tests

`pnpm --filter @ottabase/og test`: the card's bounds, the canonical form and ids, the signatures, the template's
escaping, the renderer's cache, and the routes with a fake browser.
