# @ottabase/cli — agent notes

`otta` dev CLI: scaffold, dev, build, test, and inspect monorepo apps. Full docs: ./README.md

## Use when

- Scaffolding a new app from a template (`otta new web|landing <name>`) or running dev/build/test/lint/type-check/clean per app.
- Programmatic access to app metadata: `listApps()`, `getAppInfo(name)`.
- NOT a runtime dependency for apps — for one-off scripts just use pnpm directly (`pnpm --filter <app> <script>`).

## Imports

```ts
import { program, run } from '@ottabase/cli';
import { newApp, buildApp, devApp, testApp, lintApp, typeCheckApp, cleanApp } from '@ottabase/cli';
import { listAllApps, showAppInfo, showTemplates } from '@ottabase/cli';
// utils: listApps, getAppInfo, clearAppsCache, findMonorepoRoot, getMonorepoRoot,
// getPnpmBin, runCommand, runPnpmCommand, validateAppName, APP_TEMPLATES, colors, log
import { listApps, getAppInfo, type AppInfo, type AppTemplate } from '@ottabase/cli';
```

## Canonical usage

```bash
otta new web my-app      # templates: web (Vite+TanStack+CF Workers), landing (Next.js)
otta dev my-app -p 3000
otta list && otta info my-app
```

```ts
const app: AppInfo | null = getAppInfo('my-app'); // matches dir name or packageName
const check = validateAppName('my-app'); // format + already-exists (disk I/O)
runPnpmCommand('build', '@ottabase/my-app'); // sync, args sanitized, cwd = repo root
```

## Gotchas

- `otta` needs `dist/` built first: `pnpm --filter @ottabase/cli build`; rebuild after editing src.
- `listApps()` caches for process lifetime — call `clearAppsCache()` between test cases.
- `findMonorepoRoot()` walks up from cwd looking for pnpm-workspace.yaml; returns null outside the repo. `getMonorepoRoot()` throws instead.
- `run(args)` expects full Node argv shape: pass `['node', 'otta', ...yourArgs]`.
- Requires Node >=24. App type detection: `next` dep => 'landing'; TanStack Router or `worker/` dir => 'web'.
