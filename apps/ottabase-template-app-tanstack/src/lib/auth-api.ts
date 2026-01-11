// ============================================================
// Auth API Client - Re-export from Package
// ============================================================
//
// All auth API functionality is provided by @ottabase/auth/client
// This file exists for backward compatibility and convenience.
//
// ============================================================

export {
  getCsrfToken,
  getSessionClient as getSession,
  isAuthenticatedClient as isAuthenticated,
  sendMagicLink,
  signInWithCredentials,
  signInWithProvider,
  signOut,
  type AuthClientOptions,
  type AuthResponse,
  type AuthSession,
  type SignInCredentials,
} from "@ottabase/auth/client";
