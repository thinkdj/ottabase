// ============================================================
// The packages installed in this app — the ONE list
// ============================================================
// Every package is one manifest here. From this list the Worker derives the tables init
// creates, the models and policies the ORM registers, the routes it mounts, the cron and
// queue handlers it runs, the events it subscribes, the env it checks and the health it
// reports. `otta add <package> otta-worker` appends to it; by hand it is one import and one
// line. If a package owns Drizzle tables, also re-export them from `ottabase/db/schema.ts`.
// ============================================================

import { definePackageList } from './registry';
import { corePackage } from './packages/core';
import { vaultPackage } from './packages/vault';

definePackageList(() => [corePackage, vaultPackage]);

export { packages } from './registry';
