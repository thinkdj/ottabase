# @ottabase/db — agent notes

Shared database layer: Drizzle D1 driver, MongoDB driver, raw SQL, feature-schema registry. Full docs: ./README.md

## Use when

- A package/app needs a DB connection: Cloudflare D1 (Drizzle), MongoDB, or raw SQL through a `DbDriver`.
- Registering per-app feature Prisma schemas (`defineAppDbConfig`, `defineFeatureSchema`, registry).
- NOT for Cloudflare bindings themselves (KV/R2/Queues) — that is @ottabase/cf. Model logic lives in @ottabase/ottaorm (fat models).

## Imports

    import { createD1Driver, isD1Database, type D1Driver } from '@ottabase/db/drizzle-d1';
    import { raw, BaseDbDriver, type DbDriver, type DbRawResult } from '@ottabase/db/drizzle';
    import { createMongoDriver, MongoDriver, isObjectId, toObjectId } from '@ottabase/db/mongodb';
    import { defineAppDbConfig, defineFeatureSchema, resolveAppDbConfig } from '@ottabase/db/config';
    import { getFeatureRegistry, registerFeature, discoverFeatures } from '@ottabase/db/registry';

## Canonical usage

    // D1 in a Worker (edge-safe)
    const driver = createD1Driver(env.OBCF_D1);
    const result = await raw(driver, 'SELECT * FROM users WHERE id = ?', [userId]);
    console.log(result.results);

    // MongoDB (async — opens a connection)
    const mongo = await createMongoDriver('mongodb://localhost:27017', 'myapp', { log: true });

    // App DB config (apps/<app>/db.config.ts)
    export default defineAppDbConfig({
        appId: 'web',
        dbProvider: 'd1',
        features: ['auth'],
    });

## Gotchas

- Root export `.` is MongoDB types only (`MongoDriver`, `MongoDriverConfig`); all runtime code is in subpath exports.
- index.ts comments mention `@ottabase/db/prisma`, but that subpath is NOT in the exports map — do not import it.
- `drizzle-orm`, `@prisma/client`, `mongodb` are optional peerDeps (catalog:) — install only the one you use.
- Registry `register()` silently overwrites duplicate `featureId`s (console warn only).
- `createMongoDriver` needs a Node-compatible runtime; prefer D1 for edge Workers. RLS context (organizationId/userId/appId) is enforced at the ottaorm model layer, not here.
