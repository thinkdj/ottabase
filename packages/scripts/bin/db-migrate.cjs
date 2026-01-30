#!/usr/bin/env node
// ============================================================
// @ottabase/scripts - DB Migration Generator CLI (CommonJS wrapper)
// ============================================================

// Register ts-node for TypeScript support
require('ts-node/register/transpile-only');

// Run the CLI
require('../src/cli/db-migrate.ts');
