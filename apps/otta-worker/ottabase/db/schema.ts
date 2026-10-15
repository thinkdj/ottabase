// ============================================================
// Every table this Worker owns, as static named exports
// ============================================================
// Init picks up every export whose name ends in `Table`. Core is the scheduler alone: this
// shape has no users until you add @ottabase/auth. Package tables are re-exported here too
// so drizzle-kit and `otta add` see them; init merges this with `packages.tables()`, so a
// table reaches auto-init either way.
// ============================================================

export { scheduledTasksTable } from '@ottabase/ottaorm';
