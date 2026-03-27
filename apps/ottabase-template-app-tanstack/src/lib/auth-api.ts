// ============================================================
// Auth API Client - Re-export from Package
// ============================================================
//
// All auth API functionality is provided by @ottabase/auth/client
// This file exists for convenience (re-exports from @ottabase/auth/client).
//
// ============================================================

export {
    getCsrfToken,
    getSession,
    isAuthenticated,
    registerWithCredentials,
    requestEmailVerification,
    requestPasswordReset,
    resetPassword,
    sendMagicLink,
    signInWithCredentials,
    signInWithProvider,
    signOut,
    verifyEmail,
    type AuthClientOptions,
    type AuthResponse,
    type AuthSession,
    type EmailVerificationResponse,
    type PasswordResetResponse,
    type RegisterCredentials,
    type RegisterResponse,
    type SignInCredentials,
} from '@ottabase/auth/client';
