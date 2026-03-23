// ============================================================
// Auth API Client - Re-export from Package
// ============================================================
//
// All auth API functionality is provided by @ottabase/auth/client
// This file exists for convenience (re-exports from @ottabase/auth/client).
//
// ============================================================

export {
    changePassword,
    deletePasskey,
    disableTotp,
    enableTotp,
    getCsrfToken,
    getPasskeyAuthOptions,
    getPasskeyRegisterOptions,
    getSession,
    isAuthenticated,
    listPasskeys,
    preflightCredentials,
    registerWithCredentials,
    requestEmailVerification,
    requestPasswordReset,
    resetPassword,
    sendMagicLink,
    setupTotp,
    signInWithCredentials,
    signInWithProvider,
    signOut,
    verifyEmail,
    verifyPasskeyAuth,
    verifyPasskeyRegistration,
    type AuthClientOptions,
    type AuthResponse,
    type AuthSession,
    type ChangePasswordResponse,
    type EmailVerificationResponse,
    type PasskeyInfo,
    type PasswordResetResponse,
    type PreflightResponse,
    type RegisterCredentials,
    type RegisterResponse,
    type SignInCredentials,
    type TotpSetupResponse,
} from '@ottabase/auth/client';
