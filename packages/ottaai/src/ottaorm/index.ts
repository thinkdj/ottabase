// ====================================================================
// @ottabase/ottaai/ottaorm — persistence barrel
// --------------------------------------------------------------------
// PLANE: MANAGEMENT. Model, table, RLS policy factory, ORM store, route
// factory, rotation job, and the composing factory.
//
// Registration is one manifest (`@ottabase/ottaai/manifest`): table, model and the RLS
// policy, with the STRATEGY passed once and shared with the resolver:
//
//     // ottabase/packages.ts
//     createOttaaiPackage({ strategy: 'user-then-org', routes })
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
