# @ottabase/context

One file that says what a product is. The `otta-context` schema, version 2: the shape an Ottabase app serves at
`/.well-known/otta.json` (through `@ottabase/discover`), Ottabuzz serves for a project as `context.json`, and Imageine
and Tuskly import. This package is the schema and nothing else: the types, a clamping `defineProduct`, the writer, the
lenient reader, a founder manifest, a content hash, and a fetch that knows when a file changed. No dependencies. It runs
in a Worker, in Node and in the browser, so every consumer reads through the same code and the shape cannot drift.

## The idea

The product is the single source of truth and the tools are lenses. An app declares its facts once, in code, next to the
code they describe. Everything else, the brief in Ottabuzz, the brand kit in Imageine, the press kit, the listings,
pulls from that one address and follows it. Nothing is typed twice; a changed price shows up everywhere on the next
read. Integrations between our products are great to have, never mandatory: a product with this file and no other Otta
tool near it loses nothing, and a tool reading a site without the file reads the page instead.

## Write

```typescript
import { defineProduct, ottaJson } from '@ottabase/context';

const product = defineProduct({
    name: 'Alpha',
    url: 'https://alpha.test',
    tagline: 'A SaaS starter for Cloudflare.',
    whatItIs: 'Auth and billing in the box, on one Worker.',
    whoItIsFor: 'founders who ship alone',
    problem: 'Every SaaS needs the same plumbing first.',
    features: ['Auth in the box', 'Billing in the box', 'One Worker'],
    pricing: {
        plans: [
            { name: 'Hobby', price: 'free' },
            { name: 'Pro', price: 15, period: 'month' },
        ],
    },
    founder: { name: 'Dj', title: 'solo founder', place: 'www', socials: { x: 'https://x.com/thinkdj' } },
    brand: { primary: '#f5a90a', fontHeading: 'Young Serif', logo: 'https://alpha.test/logo.png' },
    facts: { founded: '2026', category: 'Developer tools', platforms: ['Web', 'CLI'], license: 'MIT' },
    feeds: { releases: 'https://alpha.test/releases.xml' },
    links: { repo: 'https://github.com/thinkdj/alpha', press: 'https://ottabuzz.com/b/alpha/press' },
    screenshots: [{ url: 'https://alpha.test/1.png', caption: 'The radar at work' }],
    neverClaim: ['Enterprise ready'], // owner scope only; never in the public file
    updatedAt: '2026-10-01T10:00:00Z',
});

const file = ottaJson(product, { from: 'https://alpha.test/.well-known/otta.json' });
const own = ottaJson(product, { from: '...', scope: 'owner' }); // adds neverClaim and the brief
```

`defineProduct` clamps every field, drops what it cannot use (a relative address, a colour that is not `#rrggbb`, a plan
without a price) and throws only without a name or an absolute URL. It never fills a blank.

## Read

```typescript
import { fetchOtta, inherit, ottaJsonUrl, parseOttaJson } from '@ottabase/context';

const url = ottaJsonUrl('alpha.test'); // https://alpha.test/.well-known/otta.json
// 'ottabuzz.com/b/alpha/press' becomes https://ottabuzz.com/b/alpha/context.json; a .json address is taken as is.
// A private product's address keeps its owner key and loses every other query parameter:
ottaJsonUrl('https://alpha.test/.well-known/otta.json?utm_source=x&key=s3cret');
// https://alpha.test/.well-known/otta.json?key=s3cret
// The founder keeps that address where the tool keeps its secrets, and the file the tool writes never repeats it.

const got = await fetchOtta(url, { etag: kept.etag, hash: kept.hash });
if (got.status === 304 || !got.changed) return; // nothing moved
const product = got.context!.product;

// The inherit-or-pin rule: a local field that is empty follows upstream, a field the founder set is kept.
const facts = inherit(mine.facts, product.facts);
```

`parseOttaJson` reads any file leniently, version 1 or 2, from any writer: a missing or odd field becomes empty, never a
throw. A version 1 file comes back in the version 2 shape with the new blocks empty and a hash computed. `fetchOtta`
never throws either: a network failure is status 0, a body over 1 MB is not a context file.

## The document

```text
version 2, kind "otta-context", at (ISO), from (its own address), scope ("public" | "owner"), hash, product:
  version 1, unchanged ........ name, url, tagline, stage, launchOn, whatItIs, whoItIsFor, problem, features,
                                pricing (one line), different, objections, neverClaim, positioning, keywords, hero,
                                brief, bio, contact, log, feed, press, card, logo, screenshots
  version 2 ................... plans[], pricingNote, captions{url: caption}, sameAs[], docs, image,
                                brand{primary, secondary, background, foreground, fontHeading, fontBody, logo,
                                      logoDark, wordmark, icon, naming, pronounce}
                                founder{name, title, url, bio, bioShort, photo, place, socials{key: url}}
                                facts{founded, location, team, category, platforms[], license, stack}
                                feeds{blog, releases, changelog, log}
                                links{docs, repo, pricing, changelog, status, press, pressMarkdown, pressZip,
                                      context, brand, card}
                                copy{short, medium, long, boilerplate, taglines[], quotes[], angles[], story,
                                     notA[], milestones[], coverage[], metaTitle, metaDescription}
```

Every key is present: a string is `''` when unset, a list `[]`, an address `null`. `hash` is a hash of `product` with
keys in a fixed order, so the same facts give the same hash whoever wrote the file and whenever; `at` is the facts' own
`updatedAt` when they have one. Each block has one home: facts and plans belong to the product's code, copy to whoever
writes copy (Ottabuzz), brand to whoever holds the brand (Imageine). A reader takes each block from the file that owns
it and uses `inherit` for the rest.

`scope: "owner"` is the same document with the writer-only fields in: `neverClaim` and the whole `brief`. A site serves
it only behind a capability token (see `@ottabase/discover`); the public file always has them empty.

## The founder manifest

```typescript
import { founderJson, parseFounderJson } from '@ottabase/context';

founderJson(
    {
        founder: { name: 'Dj', url: 'https://think.dj', socials: { x: 'https://x.com/thinkdj' } },
        products: [
            { name: 'Alpha', url: 'https://alpha.test' },
            { name: 'Ottabuzz', url: 'https://ottabuzz.com' },
        ],
    },
    { from: 'https://think.dj/.well-known/otta.json' },
);
```

`kind: "otta-founder"`: the person and every product, each with the address of its own context file (the product's
`/.well-known/otta.json` when none is given). One address on the founder's domain lets a tool import the whole shelf.
`fetchOtta` reads either kind and says which it found.

## Why this is its own package

`@ottabase/discover` had the schema and two consumers had their own copies of the reader, so each grew the shape alone
and the copies drifted. This package has no dependencies on purpose, so Ottabuzz, Imageine and a Worker can all take it
as is, and it is the only place the shape is defined. `@ottabase/discover` depends on it and adds the Worker routes,
robots.txt, the sitemap and JSON-LD.
