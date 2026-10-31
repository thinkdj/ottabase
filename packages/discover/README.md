# @ottabase/discover

AI-readable by default. One `ProductFacts` object becomes everything a product's site needs to be found and understood
by the answer engines and the search engines alike: a `robots.txt` that names the AI search crawlers one by one, a
sitemap, `/.well-known/otta.json` with the product's facts in the shape Ottabuzz and Imageine read, Organization and
SoftwareApplication JSON-LD, and the one paragraph to paste into every profile. No model calls, no dependencies beyond
the repo's own utils, no database.

## Why these files and not others

What was measured in 2026, in one breath (sources in Ottabuzz's `RESEARCH_PALMATA.MD`):

- A site that blocks `OAI-SearchBot` is not shown in ChatGPT search answers, by OpenAI's own docs; Perplexity and
  Anthropic say the same of `PerplexityBot` and `Claude-SearchBot`. Cloudflare's crawler controls now split Search,
  Agent and Training and apply the most restrictive rule to a bot that does more than one, so the search bots are
  allowed by name, each in its own group.
- The engines fetch the official site for facts: ChatGPT's searches for "price" rose 47% in a year and 84% of factual
  answers cite an official source. Prices and a plain description in the HTML text are what gets read.
- Google says no special structured data is needed for AI features, and the one causal test of JSON-LD found no AI
  citation lift. Fifteen minutes of Organization and SoftwareApplication markup for rich results is the whole of it.
- Google ignores `llms.txt`; no engine commits to reading it. It earns its keep only on developer documentation read by
  coding agents, so it is here as a function and not as a default.

## Install

```bash
otta add discover my-worker        # a Worker-served app, or by hand below
pnpm add @ottabase/discover         # a Next.js app uses the /next entry directly
```

## The facts

```typescript
import { defineProduct } from '@ottabase/discover';

export const product = defineProduct({
    name: 'Alpha',
    url: 'https://alpha.test',
    tagline: 'A SaaS starter for Cloudflare.',
    whatItIs: 'Auth and billing in the box, on one Worker.',
    whoItIsFor: 'founders who ship alone',
    features: ['Auth in the box', 'Billing in the box', 'One Worker'],
    pricing: {
        plans: [
            { name: 'Hobby', price: 'free' },
            { name: 'Pro', price: 15, currency: 'USD', period: 'month', includes: ['8 projects'] },
        ],
        note: 'No card to start.',
    },
    founder: { name: 'Dj', url: 'https://think.dj' },
    logo: 'https://alpha.test/logo.png',
    sameAs: ['https://github.com/thinkdj/alpha'],
    launched: '2026-03-01',
    neverClaim: ['Enterprise ready'], // never published; for tools that write copy
});
```

`defineProduct` clamps every field, drops what it cannot use and throws only without a name or an absolute URL. It never
fills a blank: a missing fact stays missing in every file below.

## Next.js (App Router)

`apps/otta-landing` is the worked example. Its facts come from the site settings and the published home page the admin
already edits (`lib/product.ts`), so nothing is typed twice.

```typescript
// app/robots.ts
import { discoverRobots } from '@ottabase/discover/next';
export default async () => discoverRobots({ sitemap: 'https://alpha.test/sitemap.xml', disallow: ['/api/'] });
// off production: discoverRobots({ closed: true })
// images served under a disallowed prefix: add allow: ['/api/files/public/'], the longer path wins

// app/.well-known/otta.json/route.ts
import { ottaJsonHandler } from '@ottabase/discover/next';
export const GET = ottaJsonHandler(async () => product); // or null until there is a product
// With owner keys (one per consumer) and, when the file should not be public at all, 'private':
export const GET = ottaJsonHandler(
    async () => product,
    () => [process.env.OTTA_KEY_PRODUCT1, process.env.OTTA_KEY_PRODUCT2].filter(Boolean) as string[],
    process.env.OTTA_PRIVATE === '1' ? 'private' : 'public',
);

// app/page.tsx, the home page only
import { ProductJsonLd } from '@ottabase/discover/next';
<ProductJsonLd facts={product} />;
```

Add `@ottabase/discover` to `transpilePackages`: it ships TypeScript source, like `@ottabase/ottalanding`.
`app/sitemap.ts` needs nothing from here; Next writes the XML from the entries it already returns.

## A Worker (otta-worker shape)

```typescript
// ottabase/packages/discover.ts
import { createDiscoverPackage } from '@ottabase/discover/manifest';
import { product } from './product';

export const discoverPackage = createDiscoverPackage<CloudflareEnv>({
    facts: product, // or (env) => readFromD1(env)
    // Long random secrets, one per consumer: /.well-known/otta.json?key=<one> serves the owner copy (neverClaim,
    // the brief), uncached. Drop one from the list and that consumer is cut off; the others keep reading.
    owner: (env) => [env.OTTA_KEY_PRODUCT1, env.OTTA_KEY_PRODUCT2],
    // 'private' answers 404 to anyone without a key; leave it out for a public file.
    visibility: (env) => (env.OTTA_PRIVATE === '1' ? 'private' : 'public'),
    robots: (env) => ({ closed: env.ENVIRONMENT !== 'production', sitemap: `${product.url}sitemap.xml` }),
    sitemap: async () => [{ url: product.url }],
});
```

List it in `ottabase/packages.ts`. The Worker then answers `/robots.txt`, `/.well-known/otta.json` and `/sitemap.xml`,
mounted at `/` on static paths that never shadow the host's own routes, and the health report gains one line,
`discover:facts`, saying whether there are facts to serve.

### A private product, end to end

For a product whose facts should not sit on the open web, or whose owner lines a tool needs:

1. In the product, set `visibility: 'private'` (or leave it public and only add keys) and give `owner` one long random
   secret per consumer, as env vars: `wrangler secret put OTTA_KEY_PRODUCT1`, `wrangler secret put OTTA_KEY_PRODUCT2`.
   Deploy. `curl https://product.com/.well-known/otta.json` now answers 404;
   `curl "https://product.com/.well-known/otta.json?key=$OTTA_KEY_PRODUCT1"` answers the owner document,
   `scope: "owner"`.
2. In Ottabuzz, open the project's Brief tab and paste
   `https://product.com/.well-known/otta.json?key=<the first secret>` into "Facts file", save, then "Read again". The
   brief is rebuilt from the file with no model call, the hard lines reach "Never claim", and the press kit takes the
   facts, brand, founder and release feed it had not been told. The key stays on the project row; the `context.json`
   Ottabuzz writes for the project never carries it.
3. In Imageine, open Liftoff's Import chip and paste the address with the second secret. `ottaJsonUrl` keeps the `key`
   and drops everything else in the query, so the same address pasted with tracking parameters still works.
4. To cut one tool off, remove its secret from the list and redeploy. The other keeps reading. To make the file public
   again, drop `visibility` and keep the keys: the public shape serves without one, the owner shape with.

The key is a query parameter on purpose: a browser fetch from Imageine needs no preflight, a founder pastes one address
once, and curl and a cron work unchanged. The address therefore shows in the product's own request logs and nowhere
else; a leak is answered by dropping that one key.

### The brand block from the theme

An app already has its colours and type in its Brand Engine theme, so the brand block should come from there, not be
typed twice. `brandFromTheme` reads the light palette and the heading and body families off any theme-shaped object (the
engine is not imported) and takes the marks the theme does not know by hand:

```typescript
import { brandFromTheme, defineProduct } from '@ottabase/discover';
import { theme } from './theme';

export const product = defineProduct({
    name: 'Alpha',
    url: 'https://alpha.test',
    brand: brandFromTheme(theme, { logo: 'https://alpha.test/logo.png', logoDark: 'https://alpha.test/logo-dark.png' }),
    // ...
});
```

HSL channels ("221.2 83.2% 53.3%") become `#2563eb`; a CSS variable or a generic family is left out.

## Every generator, by hand

| Function                           | Gives                                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `robotsTxt(opts)` / `robotsRules`  | The text file, or the same rules as data in the shape `app/robots.ts` returns. `training: 'block'` blocks the training bots only. |
| `sitemapXml(entries)`              | XML with `lastmod`, escaped.                                                                                                      |
| `ottaJson(facts, { from, scope })` | The `otta-context` version 2 document, from `@ottabase/context`. `parseOttaJson(raw)` reads one back, leniently, from any source. |
| `brandFromTheme(theme, marks)`     | The brand block off a Brand Engine theme: the light palette as `#rrggbb`, the heading and body families, plus the marks given.    |
| `jsonLd(facts)` / `jsonLdScript`   | Organization, WebSite and SoftwareApplication (with offers) as one graph, or as the escaped `<script>` string.                    |
| `canonicalParagraph(facts)`        | "Alpha is a SaaS starter for Cloudflare. It is for founders who ship alone. Made by Dj, since 2026. https://alpha.test/"          |
| `llmsTxt(facts, sections)`         | For a docs site only.                                                                                                             |

## The training crawlers

`GPTBot`, `ClaudeBot`, `anthropic-ai`, `Google-Extended`, `CCBot` and `Bytespider` collect training data. Blocking them
does not change what the search crawlers see or what the answer engines say today; allowing them is the only road into
the "memory" path, where a model names a product without searching. Nothing measures how wide that road is. So it is a
switch, `training: 'allow' | 'block'`, and the default is allow.

## otta.json and the other products

`/.well-known/otta.json` is the same document Ottabuzz serves for a project as `/b/<slug>/context.json`, written here
from the product's own site. The schema, version 2, lives in `@ottabase/context`, a dependency-free package Ottabuzz and
Imageine read through as well, so the shape cannot drift: the version 1 fields unchanged, plus the plans as data, a
brand block, a founder block with photo and handles, the facts a directory asks for, feed and link addresses, the press
kit's copy, and a content hash. Ottabuzz reads the file when it exists and reads the page when it does not; Imageine's
Liftoff imports either; both use the hash to know when the product moved.

The public file carries nothing the site does not already show: `neverClaim` and the brief are always empty in it, since
it sits on the open web. The same document with them in is served to `?key=<owner key>` alone, uncached, and the key
never appears in the file. `owner` takes one key or a list, one per consumer, so a key pasted into Ottabuzz can be
revoked without touching the one in Imageine. The founder pastes the keyed address once into each tool. A wrong key gets
the public file, never an error, so a leaked guess learns nothing.

A founder who wants no public file at all sets `visibility: 'private'`: without a valid key the route answers 404, as if
the file were not there, while robots.txt and the sitemap stay. The consumers take a keyed address in place of the site:
Ottabuzz's Brief tab has a "Facts file" field, Imageine's Import chip takes the address as pasted, and `ottaJsonUrl` in
`@ottabase/context` keeps the key and drops everything else in the query.

The response carries the document's hash as its ETag; a reader that sends it back as `If-None-Match` gets a 304 and no
bytes while nothing changed. Integrations between our products are great to have, never mandatory: this package is
complete on its own, and a site without Ottabuzz or Imageine anywhere near it loses nothing.

## The checklist the package cannot do for you

1. Crawlers allowed: deploy, then fetch `/robots.txt` as a stranger. On Cloudflare, check the Search, Agent and Training
   toggles in the dashboard; they override the file.
2. Prices and a features page in plain text, rendered without JavaScript. No AI crawler except Gemini's runs scripts.
3. One canonical paragraph (`canonicalParagraph`) pasted verbatim into G2, Capterra, AlternativeTo, GitHub and LinkedIn.
4. Google Search Console and Bing Webmaster Tools verified, the sitemap submitted. Bing's AI Performance report and
   Search Console's generative AI report are the only free, first-party views of being cited.
