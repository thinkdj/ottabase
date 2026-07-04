#!/usr/bin/env node
// ============================================================
// @ottabase/scripts - DB Migration Generator CLI (CommonJS wrapper)
// ============================================================
// Runs the built CLI (dist/cli/db-migrate.js), emitted by `pnpm --filter
// @ottabase/scripts build`. Keep this in sync with the tsup entry list.
require('../dist/cli/db-migrate.js');
