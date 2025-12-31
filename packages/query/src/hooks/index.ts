// ============================================================
// @ottabase/query - Hooks Exports
// ============================================================

// Core factory
export { createModelHooks } from "./createModelHooks";

// Generic API hooks
export { useApiQuery, useApiMutation, useBatchMutation } from "./useApiQuery";

// Pre-built model hooks
export {
  useUsers,
  usePosts,
  useTags,
  createEntityHooks,
  type UserQueryType,
  type PostQueryType,
  type TagQueryType,
} from "./modelHooks";
