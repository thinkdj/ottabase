// ====================================================================
// @ottabase/ottaai/ottaorm — persistence barrel
// --------------------------------------------------------------------
// PLANE: MANAGEMENT. Model, table, RLS policy factory, ORM store, route
// factory, rotation job, and the composing factory.
//
// Copy-paste registration (order matters — see the comments in factory.ts):
//
//     // ottabase/config.migrations.ts
//     import { aiProviderCredentialsTable } from '@ottabase/ottaai/schema';
//     ottaai: { tables: { aiProviderCredentialsTable }, migrations: [] },
//
//     // worker/lib/db-utils.ts  (inside registerAppModels)
//     registerModels([...others, AiProviderCredential]);
//     initRLS();
//     registerPolicy(createCredentialPolicy({ strategy: 'user-then-org' }));
//
//     // worker/lib/ai.ts  (per request)
//     const ai = createAiProvisioningWithStorage({ ... });
// ====================================================================

export * from './AiProviderCredential.schema';
export * from './AiProviderCredential';
export * from './policy';
export * from './store';
export * from './handlers';
export * from './factory';
export * from './rewrap';
