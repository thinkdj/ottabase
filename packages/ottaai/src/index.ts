// ============================================================
// @ottabase/ottaai — Root (L0 primitives + L1 crypto + L2 pure)
// ============================================================
// DEPENDENCY-FREE by contract. No ORM, no React, no network.
//
// Crypto belongs at the ROOT, not behind `./ottaorm`: an import tool, a re-wrap
// job or a CLI must be able to encrypt without touching the ORM.
//
// Import map:
//   @ottabase/ottaai                      primitives, registry, crypto, pure scoring/merge
//   @ottabase/ottaai/resolver             createAiProvisioning, resolve, verify, gates
//   @ottabase/ottaai/ottaorm              table, model, RLS policy factory, store, handlers
//   @ottabase/ottaai/schema               the Drizzle table only (for config.migrations.ts)
//   @ottabase/ottaai/transports/gateway   the Cloudflare AI Gateway adapter
//   @ottabase/ottaai/react                hooks + settings UI
//   @ottabase/ottaai/testing              mock transport, in-memory store, fixtures
// ============================================================

export * from './errors';
export * from './secret';
export * from './registry';
export * from './model-ref';
export * from './types';
export * from './tasks';
export * from './fields';
export * from './crypto';
export * from './pure';
export * from './disclosure';
