// ============================================================
// @ottabase/auth - Frontend API Client
// ============================================================
//
// Reusable client-side functions for interacting with Auth.js backend.
// Works with any frontend framework (React, Vue, Svelte, etc.)
//
// Usage:
//   import { signInWithCredentials, signInWithProvider } from "@ottabase/auth/client";
//
// ============================================================

/**
 * Sign-in credentials
 */
export interface SignInCredentials {
    email: string;
    password: string;
}

/**
 * Registration credentials
 */
export interface RegisterCredentials {
    name?: string;
    email: string;
    password: string;
    referralCode?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
}

/**
 * Auth session
 */
export interface AuthSession {
    user: {
        id: string;
        email: string;
        name?: string | null;
        image?: string | null;
        [key: string]: any;
    };
    expires: number;
}

/**
 * Auth response
 */
export interface AuthResponse {
    success: boolean;
    error?: string;
    session?: AuthSession;
    url?: string;
}

/**
 * Registration response
 */
export interface RegisterResponse {
    success: boolean;
    error?: string;
    user?: {
        id: string;
        email: string;
        name?: string | null;
        image?: string | null;
        [key: string]: any;
    };
    organizationId?: string | null;
    organizationRole?: string | null;
    assignedRole?: string | null;
    requiresEmailVerification?: boolean;
    verificationSent?: boolean;
}

/**
 * Email verification response
 */
export interface EmailVerificationResponse {
    success: boolean;
    error?: string;
}

/**
 * Password reset response
 */
export interface PasswordResetResponse {
    success: boolean;
    error?: string;
}

/**
 * Authenticated password change response
 */
export interface ChangePasswordResponse {
    success: boolean;
    error?: string;
}

/**
 * Client configuration options
 */
export interface AuthClientOptions {
    /**
     * Base URL for auth API (default: /api/auth)
     */
    baseUrl?: string;
}

const defaultOptions: AuthClientOptions = {
    baseUrl: '/api/auth',
};

const SESSION_RETRY_ATTEMPTS = 3;
const SESSION_RETRY_BASE_DELAY_MS = 250;

function isTransientSessionStatus(status: number): boolean {
    return status === 502 || status === 503 || status === 504;
}

function waitForRetry(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const authErrorMessages: Record<string, string> = {
    CredentialsSignin: 'Invalid email or password',
    AccessDenied: 'Access denied',
    OAuthSignin: 'OAuth sign in failed',
    OAuthCallback: 'OAuth callback failed',
    OAuthAccountNotLinked: 'Account not linked to this provider',
    EmailSignin: 'Email sign in failed',
    EmailCreateAccount: 'Email account creation failed',
    CallbackRouteError: 'Authentication callback failed',
    Default: 'Authentication failed',
};

function parseAuthError(location: string | null): string | null {
    if (!location) return null;
    try {
        const url = new URL(location, 'http://localhost');
        const error = url.searchParams.get('error');
        const code = url.searchParams.get('code');
        if (error && authErrorMessages[error]) {
            return authErrorMessages[error];
        }
        if (code && authErrorMessages[code]) {
            return authErrorMessages[code];
        }
        return error || code;
    } catch {
        return null;
    }
}

function parseAuthErrorFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    return parseAuthError(url);
}

/**
 * Sign in with email and password
 */
export async function signInWithCredentials(
    credentials: SignInCredentials,
    options?: {
        redirect?: boolean;
        redirectTo?: string;
        clientOptions?: AuthClientOptions;
    },
): Promise<AuthResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;
    const csrfToken = await getCsrfToken(options?.clientOptions);

    try {
        const form = new URLSearchParams();
        form.set('email', credentials.email);
        form.set('password', credentials.password);
        if (csrfToken) {
            form.set('csrfToken', csrfToken);
        }
        form.set('redirect', String(options?.redirect ?? false));
        form.set('callbackUrl', options?.redirectTo ?? '/dashboard');
        form.set('json', 'true');

        const response = await fetch(`${baseUrl}/callback/credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Auth-Return-Redirect': '1',
            },
            credentials: 'include',
            redirect: 'manual',
            body: form.toString(),
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('Location');
            const parsedError = parseAuthError(location);
            if (parsedError) {
                return { success: false, error: parsedError };
            }
        }

        const data = await response.json().catch(() => null);

        const redirectError = parseAuthErrorFromUrl(data?.url);
        if (redirectError) {
            return { success: false, error: redirectError };
        }

        if (!response.ok || data?.error) {
            return {
                success: false,
                error: data?.error || 'Invalid credentials',
            };
        }

        if (options?.redirect && data?.url && typeof window !== 'undefined') {
            window.location.href = data.url;
            return { success: true, url: data.url };
        }

        const session = await getSession(options?.clientOptions);

        return {
            success: true,
            session: session || undefined,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Authentication failed',
        };
    }
}

/**
 * Sign in with an OAuth provider (Google, GitHub, Discord, etc.)
 */
export async function signInWithProvider(
    providerId: string,
    options?: {
        redirectTo?: string;
        clientOptions?: AuthClientOptions;
    },
): Promise<AuthResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const params = new URLSearchParams();
        params.set('callbackUrl', options?.redirectTo ?? '/dashboard');

        const signInUrl = `${baseUrl}/signin/${providerId}?${params.toString()}`;

        if (typeof window !== 'undefined') {
            window.location.href = signInUrl;
        }

        return {
            success: true,
            url: signInUrl,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to initiate OAuth sign in',
        };
    }
}

/**
 * Send a magic link to the specified email
 */
export async function sendMagicLink(
    email: string,
    options?: {
        redirectTo?: string;
        clientOptions?: AuthClientOptions;
    },
): Promise<AuthResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;
    const csrfToken = await getCsrfToken(options?.clientOptions);

    try {
        const form = new URLSearchParams();
        form.set('email', email);
        if (csrfToken) {
            form.set('csrfToken', csrfToken);
        }
        form.set('callbackUrl', options?.redirectTo ?? '/dashboard');
        form.set('json', 'true');

        const response = await fetch(`${baseUrl}/signin/email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Auth-Return-Redirect': '1',
            },
            credentials: 'include',
            redirect: 'manual',
            body: form.toString(),
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('Location');
            const parsedError = parseAuthError(location);
            if (parsedError) {
                return { success: false, error: parsedError };
            }
        }

        const data = await response.json().catch(() => null);

        const redirectError = parseAuthErrorFromUrl(data?.url);
        if (redirectError) {
            return { success: false, error: redirectError };
        }

        if (!response.ok || data?.error) {
            return {
                success: false,
                error: data?.error || 'Failed to send magic link',
            };
        }

        return {
            success: true,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send magic link',
        };
    }
}

/**
 * Register a new user with credentials
 */
export async function registerWithCredentials(
    data: RegisterCredentials,
    options?: { clientOptions?: AuthClientOptions },
): Promise<RegisterResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const response = await fetch(`${baseUrl}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Registration failed' }));
            return {
                success: false,
                error: error.error || 'Registration failed',
            };
        }

        const payload = await response.json().catch(() => ({}));
        return {
            success: true,
            user: payload.user,
            organizationId: payload.organizationId ?? null,
            organizationRole: payload.organizationRole ?? null,
            assignedRole: payload.assignedRole ?? null,
            requiresEmailVerification: payload.requiresEmailVerification ?? false,
            verificationSent: payload.verificationSent ?? false,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Registration failed',
        };
    }
}

/**
 * Get the current session
 */
export async function getSession(options?: AuthClientOptions): Promise<AuthSession | null> {
    const baseUrl = options?.baseUrl ?? defaultOptions.baseUrl;

    for (let attempt = 1; attempt <= SESSION_RETRY_ATTEMPTS; attempt += 1) {
        try {
            const response = await fetch(`${baseUrl}/session`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                cache: 'no-store',
            });

            if (!response.ok) {
                if (attempt < SESSION_RETRY_ATTEMPTS && isTransientSessionStatus(response.status)) {
                    await waitForRetry(SESSION_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
                    continue;
                }

                return null;
            }

            const session = await response.json().catch(() => null);

            if (!session || !session.user) {
                return null;
            }

            return session as AuthSession;
        } catch (error) {
            if (attempt < SESSION_RETRY_ATTEMPTS) {
                await waitForRetry(SESSION_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
                continue;
            }

            console.error('Failed to get session:', error);
            return null;
        }
    }

    return null;
}

/**
 * Sign out the current user
 */
export async function signOut(options?: {
    redirectTo?: string;
    clientOptions?: AuthClientOptions;
}): Promise<AuthResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;
    const csrfToken = await getCsrfToken(options?.clientOptions);

    try {
        const params = new URLSearchParams();
        if (options?.redirectTo) {
            params.set('callbackUrl', options.redirectTo);
        }

        const form = new URLSearchParams();
        if (csrfToken) {
            form.set('csrfToken', csrfToken);
        }
        if (options?.redirectTo) {
            form.set('callbackUrl', options.redirectTo);
        }
        form.set('json', 'true');

        const response = await fetch(`${baseUrl}/signout?${params.toString()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Auth-Return-Redirect': '1',
            },
            credentials: 'include',
            redirect: 'manual',
            body: form.toString(),
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('Location');
            const parsedError = parseAuthError(location);
            if (parsedError) {
                return { success: false, error: parsedError };
            }
        }

        const data = await response.json().catch(() => null);

        const redirectError = parseAuthErrorFromUrl(data?.url);
        if (redirectError) {
            return { success: false, error: redirectError };
        }

        if (!response.ok || data?.error) {
            return {
                success: false,
                error: data?.error || 'Failed to sign out',
            };
        }

        return {
            success: true,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to sign out',
        };
    }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(options?: AuthClientOptions): Promise<boolean> {
    const session = await getSession(options);
    return session !== null;
}

/**
 * Get CSRF token for forms
 */
export async function getCsrfToken(options?: AuthClientOptions): Promise<string | null> {
    const baseUrl = options?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const response = await fetch(`${baseUrl}/csrf`, {
            credentials: 'include',
        });
        if (!response.ok) return null;

        try {
            const data = await response.json();
            return data.csrfToken || null;
        } catch {
            return null;
        }
    } catch (error) {
        console.error('Failed to get CSRF token:', error);
        return null;
    }
}

/**
 * Request an email verification (resend)
 */
export async function requestEmailVerification(
    email: string,
    options?: { clientOptions?: AuthClientOptions },
): Promise<EmailVerificationResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const response = await fetch(`${baseUrl}/verify-email/resend`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to send verification email' }));
            return {
                success: false,
                error: error.error || 'Failed to send verification email',
            };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send verification email',
        };
    }
}

/**
 * Verify email with token (used by verification page)
 */
export async function verifyEmail(
    token: string,
    email: string,
    options?: { clientOptions?: AuthClientOptions },
): Promise<EmailVerificationResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const params = new URLSearchParams({ token, email });
        const response = await fetch(`${baseUrl}/verify-email?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Email verification failed' }));
            return {
                success: false,
                error: error.error || 'Email verification failed',
            };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Email verification failed',
        };
    }
}

/**
 * Request a password reset email
 */
export async function requestPasswordReset(
    email: string,
    options?: { clientOptions?: AuthClientOptions },
): Promise<PasswordResetResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const response = await fetch(`${baseUrl}/password/reset/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to request password reset' }));
            return {
                success: false,
                error: error.error || 'Failed to request password reset',
            };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to request password reset',
        };
    }
}

/**
 * Reset password with token
 */
export async function resetPassword(
    data: { email: string; token: string; password: string },
    options?: { clientOptions?: AuthClientOptions },
): Promise<PasswordResetResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const response = await fetch(`${baseUrl}/password/reset/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Password reset failed' }));
            return {
                success: false,
                error: error.error || 'Password reset failed',
            };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Password reset failed',
        };
    }
}

/**
 * Change password for the current authenticated user
 */
export async function changePassword(
    data: { currentPassword: string; newPassword: string },
    options?: { clientOptions?: AuthClientOptions },
): Promise<ChangePasswordResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const response = await fetch(`${baseUrl}/password/change`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Password change failed' }));
            return {
                success: false,
                error: error.error || 'Password change failed',
            };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Password change failed',
        };
    }
}
