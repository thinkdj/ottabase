// ============================================================
// @ottabase/ottaorm - Main Exports
// ============================================================

// Connection management (multi-database support)
export {
  registerConnection,
  getConnection,
  hasConnection,
  clearConnection,
  clearAllConnections
} from "./context";

// Model registry (for dynamic model lookup)
export {
  registerModel,
  registerModels,
  getModel,
  hasModel,
  getRegisteredModels,
  clearModelRegistry,
} from "./registry";

// Generic CRUD handler
export { handleCrud, parseCrudRequest } from "./crud";
export type { CrudRequest, CrudResponse } from "./crud";

// Migrations
export { runMigrations, rollbackMigrations, coreMigrations } from "./migrations";
export type { Migration } from "./migrations";

/**
 * Base models (Edge-safe)
 *
 * Note: MongoDB-related exports are intentionally NOT exported from this entrypoint
 * because they pull in the `mongodb` package (Node-only) which breaks Next.js Edge runtime.
 */
export { AbstractBaseModel, BaseModel } from "./base";
export type {
  IModelConstructorParams,
  ModelFieldType,
  ModelFieldDescriptor,
  ModelFields,
  PaginationResult,
} from "./base";

/**
 * Core models (SQL only - Edge-safe)
 *
 * These exports are safe for Next.js Edge runtime.
 */
export {
  User,
  usersTable,
  Account,
  accountsTable,
  Post,
  postsTable,
  postTagsTable,
  Tag,
  tagsTable,
  // Auth.js SQL models (Edge-safe)
  Authenticator,
  authenticatorsTable,
  Session,
  sessionsTable,
  VerificationToken,
  verificationTokensTable,
} from "./models";
export type {
  UserType,
  NewUserType,
  AccountType,
  NewAccountType,
  PostType,
  NewPostType,
  TagType,
  NewTagType,
  AuthenticatorType,
  NewAuthenticatorType,
  SessionType,
  NewSessionType,
  VerificationTokenType,
  NewVerificationTokenType,
} from "./models";
