// ============================================================
// The packages installed in this app — the ONE list
// ============================================================
// Every package, free or paid, is one manifest here. From this list the framework derives
// the tables auto-init creates, the models and RLS policies the ORM registers, the API
// routes it mounts, the cron and queue handlers it runs, the events it subscribes, the
// admin nav it shows, the env it checks and the health it reports.
//
// To add a package: import its manifest and add it to the list below. If it renders admin
// pages, add its client descriptor to `src/ottabase/config/packages.ts` as well; the
// packages-registration test fails if the two lists drift. If it has Drizzle tables, also
// re-export them from `ottabase/db/schema.ts` so drizzle-kit sees them without evaluating
// this module.
//
// Order matters only for display. Clashes (a table export name, a cron handler, a queue job
// type contributed twice) throw at first use, with both package names.
//
// The registry itself lives in `./registry` (see the note there on import cycles). This
// module loads the manifests and hands the list over; import it from entry-ish code.
// ============================================================

import { definePackageList } from './registry';
import { apiKeysPackage } from './packages/apikeys';
import { appPackage } from './packages/app';
import { brandEnginePackage } from './packages/brand-engine';
import { commentsPackage } from './packages/comments';
import { corePackage } from './packages/core';
import { flagsPackage } from './packages/flags';
import { meterPackage } from './packages/meter';
import { ottaaiPackage } from './packages/ottaai';
import { ottablogPackage } from './packages/ottablog';
import { ottalandingPackage } from './packages/ottalanding';
import { referralsPackage } from './packages/referrals';
import { shortlinksPackage } from './packages/shortlinks';
import { webhooksPackage } from './packages/webhooks';

definePackageList(() => [
    corePackage,
    appPackage,
    brandEnginePackage,
    ottablogPackage,
    commentsPackage,
    ottalandingPackage,
    shortlinksPackage,
    referralsPackage,
    ottaaiPackage,
    flagsPackage,
    meterPackage,
    apiKeysPackage,
    // Premium: collected like the rest; routes and lifecycle are the premium registry's.
    webhooksPackage,
]);

export { packages } from './registry';
