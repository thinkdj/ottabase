// ============================================================
// @ottabase/flags - Feature Flags for SaaS
// ============================================================

// Schema & types
export { featureFlagsTable } from './schema';
export type { FeatureFlagRecord, NewFeatureFlagRecord, FlagRules } from './schema';

// OttaORM model
export { FeatureFlag } from './model';

// Evaluation engine
export { evaluateFlag, evaluateFlags } from './engine';
export type { EvalContext, ResolvedFlag } from './engine';

// KV cache
export { getCachedFlags, invalidateFlagCache } from './cache';
