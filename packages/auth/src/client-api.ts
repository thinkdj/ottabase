// ============================================================
// @ottabase/auth - Frontend API Client
// ============================================================
//
// Framework-agnostic client for the auth backend. Talks JSON end-to-end;
// there is no Auth.js REST convention (form-encoded bodies, manual
// redirect handling, `X-Auth-Return-Redirect`) to replicate since both
// sides of the wire are implemented in this package.
//
// ============================================================

export interface SignInCredentials {
    email: string;
    password: string;
}

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

export interface AuthResponse {
    success: boolean;
    error?: string;
    session?: AuthSession;
    url?: string;
}

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

export interface EmailVerificationResponse {
    success: boolean;
    error?: string;
}

export interface PasswordResetResponse {
    success: boolean;
    error?: string;
}

export interface ChangePasswordResponse {
    success: boolean;
    error?: string;
}

export interface AuthClientOptions {
    /** Base URL for the auth API. Default: `/api/auth`. */
    baseUrl?: string;
}

const defaultOptions: AuthClientOptions = { baseUrl: '/api/auth' };

const SESSION_RETRY_ATTEMPTS = 3;
const SESSION_RETRY_BASE_DELAY_MS = 250;

function isTransientSessionStatus(status: number): boolean {
    return status === 502 || status === 503 || status === 504;
}

function waitForRetry(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonSafe(response: Response): Promise<any | null> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

/** Fetch a fresh CSRF token; also sets the paired HttpOnly cookie the server checks it against. */
export async function getCsrfToken(options?: AuthClientOptions): Promise<string | null> {
    const baseUrl = options?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const response = await fetch(`${baseUrl}/csrf`, { credentials: 'include' });
        if (!response.ok) return null;
        const data = await readJsonSafe(response);
        return data?.csrfToken ?? null;
    } catch (error) {
        console.error('Failed to get CSRF token:', error);
        return null;
    }
}

/** Sign in with email and password. */
export async function signInWithCredentials(
    credentials: SignInCredentials,
    options?: { redirect?: boolean; redirectTo?: string; clientOptions?: AuthClientOptions },
): Promise<AuthResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const csrfToken = await getCsrfToken(options?.clientOptions);

        const response = await fetch(`${baseUrl}/callback/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: credentials.email, password: credentials.password, csrfToken }),
        });

        const data = await readJsonSafe(response);

        if (!response.ok || !data?.success) {
            return { success: false, error: data?.error || 'Invalid credentials' };
        }

        if (options?.redirect && typeof window !== 'undefined') {
            window.location.href = options.redirectTo ?? '/dashboard';
        }

        return { success: true, session: data.session };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Authentication failed' };
    }
}

/** Sign in with an OAuth provider (Google, GitHub, Discord, Azure AD, Auth0). */
export async function signInWithProvider(
    providerId: string,
    options?: { redirectTo?: string; clientOptions?: AuthClientOptions },
): Promise<AuthResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const params = new URLSearchParams({ callbackUrl: options?.redirectTo ?? '/dashboard' });
        const signInUrl = `${baseUrl}/signin/${providerId}?${params.toString()}`;

        if (typeof window !== 'undefined') {
            window.location.href = signInUrl;
        }

        return { success: true, url: signInUrl };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to initiate OAuth sign in' };
    }
}

/** Send a magic (passwordless) sign-in link to the given email. */
export async function sendMagicLink(
    email: string,
    options?: { redirectTo?: string; clientOptions?: AuthClientOptions },
): Promise<AuthResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const csrfToken = await getCsrfToken(options?.clientOptions);

        const response = await fetch(`${baseUrl}/signin/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, csrfToken, callbackUrl: options?.redirectTo ?? '/dashboard' }),
        });

        const data = await readJsonSafe(response);

        if (!response.ok || !data?.success) {
            return { success: false, error: data?.error || 'Failed to send magic link' };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to send magic link' };
    }
}

/** Register a new user with credentials (requires the host app's `/api/auth/register` endpoint). */
export async function registerWithCredentials(
    data: RegisterCredentials,
    options?: { clientOptions?: AuthClientOptions },
): Promise<RegisterResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const response = await fetch(`${baseUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await readJsonSafe(response);
            return { success: false, error: error?.error || 'Registration failed' };
        }

        const payload = (await readJsonSafe(response)) ?? {};
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
        return { success: false, error: error instanceof Error ? error.message : 'Registration failed' };
    }
}

/** Get the current session, retrying transient upstream failures. */
export async function getSession(options?: AuthClientOptions): Promise<AuthSession | null> {
    const baseUrl = options?.baseUrl ?? defaultOptions.baseUrl;

    for (let attempt = 1; attempt <= SESSION_RETRY_ATTEMPTS; attempt += 1) {
        try {
            const response = await fetch(`${baseUrl}/session`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
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

            const session = await readJsonSafe(response);
            if (!session || !session.user) return null;

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

/** Sign out the current session. */
export async function signOut(options?: { redirectTo?: string; clientOptions?: AuthClientOptions }): Promise<AuthResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const csrfToken = await getCsrfToken(options?.clientOptions);

        const response = await fetch(`${baseUrl}/signout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ csrfToken }),
        });

        const data = await readJsonSafe(response);

        if (!response.ok || data?.error) {
            return { success: false, error: data?.error || 'Failed to sign out' };
        }

        if (options?.redirectTo && typeof window !== 'undefined') {
            window.location.href = options.redirectTo;
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to sign out' };
    }
}

/** Check if the current visitor has an authenticated session. */
export async function isAuthenticated(options?: AuthClientOptions): Promise<boolean> {
    const session = await getSession(options);
    return session !== null;
}

/** Request a verification email be (re)sent. */
export async function requestEmailVerification(
    email: string,
    options?: { clientOptions?: AuthClientOptions },
): Promise<EmailVerificationResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const response = await fetch(`${baseUrl}/verify-email/resend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const error = await readJsonSafe(response);
            return { success: false, error: error?.error || 'Failed to send verification email' };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to send verification email' };
    }
}

/** Verify an email using the token from a verification link. */
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
            const error = await readJsonSafe(response);
            return { success: false, error: error?.error || 'Email verification failed' };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Email verification failed' };
    }
}

/** Request a password reset email. */
export async function requestPasswordReset(
    email: string,
    options?: { clientOptions?: AuthClientOptions },
): Promise<PasswordResetResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const response = await fetch(`${baseUrl}/password/reset/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const error = await readJsonSafe(response);
            return { success: false, error: error?.error || 'Failed to request password reset' };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to request password reset' };
    }
}

/** Reset a password using a reset-email token. */
export async function resetPassword(
    data: { email: string; token: string; password: string },
    options?: { clientOptions?: AuthClientOptions },
): Promise<PasswordResetResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const response = await fetch(`${baseUrl}/password/reset/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await readJsonSafe(response);
            return { success: false, error: error?.error || 'Password reset failed' };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Password reset failed' };
    }
}

/** Change the password for the currently authenticated user. */
export async function changePassword(
    data: { currentPassword: string; newPassword: string },
    options?: { clientOptions?: AuthClientOptions },
): Promise<ChangePasswordResponse> {
    const baseUrl = options?.clientOptions?.baseUrl ?? defaultOptions.baseUrl;

    try {
        const response = await fetch(`${baseUrl}/password/change`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await readJsonSafe(response);
            return { success: false, error: error?.error || 'Password change failed' };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Password change failed' };
    }
}
