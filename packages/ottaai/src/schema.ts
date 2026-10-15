// ============================================================
// @ottabase/ottaai/schema — the Drizzle table only
// ============================================================
// A DEPENDENCY-FREE entry point for `db/schema.ts` (and manifests), so
// registering the table for auto-migrations does NOT pull the model, the ORM store
// or the route factory into whatever is importing it (drizzle-kit included).
//
// Same convention as `@ottabase/comments/schema`.
// ============================================================

export {
    aiProviderCredentialsTable,
    type AiProviderCredentialType,
    type NewAiProviderCredentialType,
} from './ottaorm/AiProviderCredential.schema';
