---
name: ottabase-new-app
description:
    The Ottabase way to create a new app in the monorepo with `otta new` (web, landing or worker template, presets,
    landing-to-web pairing) and take it to a first deploy. Use for "new app", "scaffold an app", "start a project on
    Ottabase", "second app", "landing page for my app", "a single Worker app". Encodes what the scaffolder makes the
    app's own, what is left to the maker, and how CI gets the app's values.
---

# Create a new app

## Never hand-copy an app folder

`cp -r apps/otta-web apps/x` keeps otta-web's database, buckets, queues, CI values, rate limiter ids, dev ports, `appId`
and auth cookies: the copy deploys against otta-web's data. `otta new` is the one way in.

## Pick the template

- Full stack (users, admin, SPA): `pnpm otta new web <name>`; trimmed: `--minimal`, `--preset blog|saas`.
- Public site edited from a web app's admin: `pnpm otta new landing <name> --web <web-app>` (`--web` may be left out
  when `apps/` has one web app). It binds that web app's database and public bucket and its CI values. Never rename them
  to the landing's own: `otta deploy` creates a resource it does not find, an empty one.
- One Worker, server-rendered + API: `pnpm otta new worker <name>`.
- A UI unlike the template's: start from `--minimal` and add `apps/<name>/AGENTS.md` naming the root UI rules it opts
  out of.

Names: lowercase DNS label, at most 32 characters (bucket names cap at 63).

## What the scaffolder already did (do not redo it)

`ottabase-<name>-…` resources, `OTTABASE_<NAME>_…` placeholders (except `CLOUDFLARE_ACCOUNT_ID`), fresh rate limiter
ids, free dev ports, `appId`/`appName`/company in `ottabase/ottabase.config.ts`, `APP_ID` in `.env.example`. Where
`APP_ID` is set (dev, via `.env.local`) the auth cookies carry it (`ottabase.<APP_ID>.session-token`), so apps on
`127.0.0.1` keep their own sessions.

## Then

1. `pnpm install`, `pnpm env:secrets --app=<name>`, `pnpm otta dev <name>` (bootstrap wizard on first run).
2. Write the app's description, author, tagline, keywords in `ottabase/ottabase.config.ts`.
3. Strip unused packages: `pnpm otta strip <package> <name>`; add one: `pnpm otta add <package> <name>`.
4. Gates: `pnpm otta lint|type-check|test <name>`.
5. First deploy from a terminal: `pnpm cf:login && pnpm otta deploy <name>`. For CI, set the values `otta new` printed
   (`cf:setup --app=<name>` prints them) as GitHub secrets or Workers Builds variables.

## Gotchas

- Root `pnpm dev`, `build`, `cf:*` and `otta <cmd>` without an app act on `ottabase.defaultApp` (otta-web). Pass the
  app, or set `OTTABASE_APP` / `defaultApp`.
- Two apps share a resource only when their configs name the same one and their CI values match. Do it on purpose
  (landing ↔ web), never by leaving a template's name.
- Template comments, docs and fixtures still say `otta-web`; they change nothing.

## Authoritative sources

`docs/NEW_APP.md` (the walkthrough), `packages/cli/README.md`, `.github/DEPLOYMENT.md`, `AGENTS.MD`.
