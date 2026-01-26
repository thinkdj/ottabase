// ============================================================
// @ottabase/ottaorm - Models Export
// ============================================================

// Core models - Fat Model Pattern
export { Account, accountsTable, type AccountType, type NewAccountType } from "./Account";
export { Tag, tagsTable, type NewTagType, type TagType } from "./Tag";
export { User, usersTable, type NewUserType, type UserType } from "./User";

// Auth.js models
export {
  Authenticator,
  authenticatorsTable,
  type AuthenticatorType,
  type NewAuthenticatorType,
} from "./Authenticator";
export {
  Session,
  sessionsTable,
  type NewSessionType,
  type SessionType,
} from "./Session";
export {
  VerificationToken,
  verificationTokensTable,
  type NewVerificationTokenType,
  type VerificationTokenType,
} from "./VerificationToken";

// Cron scheduler
export {
  ScheduledTask,
  scheduledTasksTable,
  type NewScheduledTaskType,
  type ScheduledTaskType,
} from "./ScheduledTask";

