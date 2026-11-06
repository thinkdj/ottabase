# A new app

`otta new` copies a template into `apps/<name>` and makes everything in it the new app's own: its name, its Cloudflare
resources, the values CI deploys it with, its dev ports and its identity. This page is the whole path, from choosing a
template to a deploy from CI.

## 1. Choose the template

| You need                                                      | Command                                         |
| ------------------------------------------------------------- | ----------------------------------------------- |
| Signed-in users, an admin, a client app: the full stack       | `pnpm otta new web my-app`                      |
| The same, without the demo and the packages you do not use    | `pnpm otta new web my-app --minimal` (or below) |
| A public site whose content a web app's admin edits (Next.js) | `pnpm otta new landing my-site`                 |
| One Worker: server-rendered HTML and an API, no SPA           | `pnpm otta new worker my-tool`                  |

Presets keep part of the web template: `--minimal` (auth, organizations, RBAC, the admin shell, Brand Engine),
`--preset blog`, `--preset saas`; `pnpm otta presets` lists them. Add a package back later with
`pnpm otta add <package> my-app`; take one out with `pnpm otta strip <package> my-app`.

The name is a lowercase DNS label (`my-app`): it becomes the Worker's name, so its `workers.dev` hostname. Keep it to 32
characters, or `ottabase-<name>-files-private-preview` passes Cloudflare's 63 for a bucket name (`otta new` refuses it).

**A landing app belongs to a web app.** It reads the content that web app's admin writes, so it binds that app's
database and public bucket. With one web app in `apps/` it pairs with it; with several, name it:
`pnpm otta new landing my-site --web my-app`.

**A different UI.** The web template carries an admin chassis built on `@ottabase/ui`. For an app whose UI is its own,
start from `--minimal` (the smallest web app) and put an `apps/<name>/AGENTS.md` beside it that says which UI rules of
the root `AGENTS.MD` it does not follow, so agents working in it do not pull it back.

## 2. What `otta new` sets for you

| What                       | Template (otta-web)                     | New app `my-app`                                        |
| -------------------------- | --------------------------------------- | ------------------------------------------------------- |
| Worker and package         | `otta-web`, `@ottabase/otta-web`        | `my-app`, `@ottabase/my-app`                            |
| D1, R2, queues             | `ottabase-db`, `ottabase-vault-staging` | `ottabase-my-app-db`, `ottabase-my-app-vault-staging`   |
| CI values (placeholders)   | `D1_DATABASE_ID`, `KV_NAMESPACE_ID`     | `OTTABASE_MY_APP_D1_DATABASE_ID`, …                     |
| Rate limiter ids           | `1001`, `2001`, …                       | the next ids no app in `apps/` holds                    |
| Dev ports                  | 3003 (Vite), 3004 (Worker)              | the first free ones above them (`otta new` prints them) |
| `appId`, `appName`         | `otta-web`, `Ottabase Template App`     | `my-app`, `My App` (`ottabase/ottabase.config.ts`)      |
| `APP_ID` in `.env.example` | `otta-web`                              | `my-app`                                                |
| Auth cookies in dev        | `ottabase.otta-web.session-token`       | `ottabase.my-app.session-token` (from `APP_ID`)         |

Why each matters: two apps on one D1 or bucket share data; two apps on one CI value deploy against one database (CI's
values are one bag of secrets for every app); two apps on one rate limiter id share its counters (the id is unique to
the Cloudflare account); two apps on one port cannot run side by side; and `appId` scopes the rows apps may share in a
database (alerts) and, through `APP_ID`, the auth cookies (a browser keeps one cookie per name for every port of
`127.0.0.1`; a deployed app has a host of its own).

`CLOUDFLARE_ACCOUNT_ID` stays as it is: every app in the account fills it with the same value.

What stays the template's: comments, docs and test fixtures that mention `otta-web`, the demo content, and the tagline
and keywords in `ottabase.config.ts` (the company becomes the app's name, the author and description are left for you to
write).

## 3. Run it

```bash
pnpm install
pnpm env:secrets --app=my-app      # .env.local with development secrets (web template)
pnpm otta dev my-app               # Vite + a local Worker on the ports otta new printed
```

The first run of a web app opens its bootstrap wizard (`/__bootstrap__`), which creates the tables and the owner
account. Name, metadata and brand: `apps/my-app/ottabase/ottabase.config.ts`.

`pnpm dev`, `dev:fe`, `dev:be`, `build`, `build:app`, the `cf:*` scripts and `otta start`/`dev`/`build`/`test`/`lint`/
`type-check`/`clean` without an app act on `ottabase.defaultApp` in the root `package.json` (`otta-web` as shipped).
Pass the app (`pnpm otta dev my-app`), set `OTTABASE_APP=my-app`, or change `defaultApp` when this is the app you work
on.

## 4. Deploy it

**From a terminal**, the first deploy is one command: it creates the app's Cloudflare resources (by the names in its
`wrangler.jsonc`), fills its config, builds, deploys, sets the secrets it cannot run without, and bootstraps the
database when an owner is given.

```bash
pnpm cf:login
pnpm otta deploy my-app --owner-email me@example.com --owner-password '…'
```

`OTTA_OWNER_PASSWORD` in the environment works in place of `--owner-password` and keeps the password out of shell
history.

**From CI**, a deploy creates nothing: it fills the app's placeholders with values it is given. `otta new` prints the
names (`OTTABASE_MY_APP_D1_DATABASE_ID`, `OTTABASE_MY_APP_KV_NAMESPACE_ID`, and the preview ones), and
`pnpm cf:setup --app=my-app` (or the first terminal deploy) prints their values.

- **Workers Builds**: connect the repository to the `my-app` Worker, deploy command `pnpm otta deploy my-app --ci`, the
  values as build variables, and the watch paths `pnpm otta deploy my-app --watch-paths` prints.
  [`.github/DEPLOYMENT.md`](../.github/DEPLOYMENT.md#cloudflare-workers-builds) has every field.
- **GitHub Actions**: add the values as repository secrets. `deploy.yml` and `pr-preview.yml` find the app on their own
  (`cloudflare-config.json`: `deployable`, `previewDeployable`).

A landing app's CI values are its web app's: the same names, so the same database.

## 5. Checklist

- [ ] `pnpm otta dev my-app` starts and `/api/health` answers with `"name": "my-app"`
- [ ] `ottabase/ottabase.config.ts`: description, author, tagline, keywords written for this app
- [ ] The packages it does not use stripped (`pnpm otta strip <package> my-app`)
- [ ] `pnpm otta lint my-app`, `pnpm otta type-check my-app`, `pnpm otta test my-app` green
- [ ] First deploy from a terminal, then the CI values set where CI runs
- [ ] `defaultApp` in the root `package.json` set to it, if it is the app you work on

See also: [`packages/cli/README.md`](../packages/cli/README.md) (every command),
[`.github/DEPLOYMENT.md`](../.github/DEPLOYMENT.md) (deploys), [`CLOUDFLARE_DEPLOY.md`](CLOUDFLARE_DEPLOY.md) (resources
and secrets), `AGENTS.MD` (the rules agents follow).
