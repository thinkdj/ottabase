# @ottabase/kernel

The Ottabase package contract. One manifest declares everything a package contributes to an app; one registry wires all
of it in. Free and paid packages share the contract. A paid one adds licensing on top with `@ottabase/premium`.

Before the kernel, adding a package meant editing four app files (`ottabase.config.ts`, `config.migrations.ts`,
`config.routes.ts`, `db-utils.ts`) plus the cron and queue registries, the admin nav and the client router, and a
missing edit failed silently. Now a package is one entry in one list, and every clash throws at boot with both package
names in the message.

## Install

```bash
pnpm add @ottabase/kernel
```

## A manifest

```typescript
import { definePackage } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';

export const notesPackage = definePackage<CloudflareEnv>({
    key: 'notes',
    name: 'Notes',
    version: '1.0.0',

    tables: { notesTable }, // keys must end in `Table`, or auto-init skips them
    migrations: [],
    models: [Note],
    policies: [notesPolicy],

    routes: {
        basePath: '/api/notes',
        build: () => new Router<CloudflareEnv>().get('/', listNotes),
        before: requireSession, // middleware for the whole subtree
    },
    cron: {
        'notes:purge': { description: 'Delete trashed notes', handler: purgeNotes, schedule: '0 3 * * *' },
    },
    queue: { 'notes:index': indexNote },
    events: [{ event: 'user.deleted', handler: forgetUser, via: 'queue' }],

    nav: [
        {
            title: 'Notes',
            description: 'Manage notes',
            href: '/admin/content/notes',
            icon: 'StickyNote',
            group: 'content',
        },
    ],
    env: { required: ['OBCF_D1'], optional: ['NOTES_WEBHOOK'] },
    health: async (env) => ({ name: 'd1', ok: Boolean(env.OBCF_D1) }),
    lifecycle: { onInstall: seedDefaults },
});
```

| Field             | What the app does with it                                                          |
| ----------------- | ---------------------------------------------------------------------------------- |
| `tables`          | Merged into auto-init and the drizzle schema                                       |
| `migrations`      | Appended after the tables                                                          |
| `suppressIndexes` | Index names auto-init must not create                                              |
| `models`          | Registered with OttaORM at boot                                                    |
| `policies`        | RLS policies registered after `initRLS()`                                          |
| `routes`          | Mounted on the API router, with an optional `when` gate and `before` middleware    |
| `cron`            | Registered with the scheduler; `schedule` seeds a `scheduled_tasks` row on install |
| `queue`           | Registered with the queue handler registry                                         |
| `events`          | Subscribed on the app's `@ottabase/events` bus                                     |
| `nav`             | Admin sidebar and overview cards                                                   |
| `env`             | Required keys are checked by the health report                                     |
| `health`          | Probed by `/api/health`                                                            |
| `lifecycle`       | `onInstall` / `onUpgrade` run from the init route, versions recorded in KV         |
| `errors`          | `report(incident)` receives every unhandled error the host hands to the registry   |

`registry.report(incident)` fans an incident out to every `errors` reporter and never rejects. A request boundary passes
`waitUntil` and does not wait; a scheduled task or queue batch has no `waitUntil` and must `await` it, or the reports
die with the handler.

Cron handler names and queue job types are app-wide. Namespace them (`notes:purge`); the registry throws on a clash.

## The registry

```typescript
import { createPackageRegistry, mountPackages, runHealth } from '@ottabase/kernel';

export const packages = createPackageRegistry<CloudflareEnv>({ packages: [notesPackage, blogPackage] });

packages.tables(); // → auto-init
packages.models(); // → registerModels()
packages.cron(); // → scheduler.registerHandlers()
mountPackages(apiRouter, { packages }); // → routes
await runHealth(packages, env); // → { ok, checks: [{ package, name, ok }] }
```

`createPackageRegistry` collects eagerly and throws at boot on a duplicate package key, table export name, cron handler
name or queue job type. Everything else is a plain getter that returns a copy.

## Premium packages

A manifest with `premium: true` (which `definePremiumPackage` sets) is collected like any other, but `mountPackages`
leaves its routes alone and `applyPackageLifecycle` leaves its hooks alone: `@ottabase/premium` mounts them behind the
license gate and runs the license-aware lifecycle. A package's routes receive a `PackageHost` with the app registry and,
for premium packages, the premium registry (`premiumRegistryOf(host)`).

## The client half

A server manifest carries session resolution and route factories, which have no place in a browser bundle. A package
with rendered admin pages also ships a client descriptor from `@ottabase/kernel/client`:

```typescript
import { definePackageClient } from '@ottabase/kernel/client';
import { StickyNote } from 'lucide-react';

export const notesClient = definePackageClient({
    key: 'notes',
    adminPages: [
        {
            path: '/admin/content/notes',
            title: 'Notes',
            description: 'Manage notes',
            icon: StickyNote,
            group: 'content',
            scope: 'org',
            load: () => import('./react/NotesAdminPage'),
            exportName: 'NotesAdminPage',
        },
    ],
});
```

The app lists client descriptors next to the server manifests; `installedPackages(clients)` gives the browser the same
`{ [key]: true }` map `registry.installed()` gives the Worker, and a parity test keeps the two lists honest.

## Lifecycle

```typescript
import { applyPackageLifecycle, createKvInstallStore } from '@ottabase/kernel';

await applyPackageLifecycle({ registry: packages, env, store: createKvInstallStore(env.OBCF_KV) });
```

Run it from the init route after the tables exist. First sight of a key runs `onInstall`; a version change runs
`onUpgrade`; the version is recorded either way. Hooks are best-effort: one that throws is logged, the transition is
still recorded, and the app keeps booting. Anything that must succeed belongs in a migration.
