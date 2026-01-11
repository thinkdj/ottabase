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
    expires: string;
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
 * Client configuration options
 */
export interface AuthClientOptions {
    /**
     * Base URL for auth API (default: /api/auth)
     */
    baseUrl?: string;
}

const defaultOptions: AuthClientOptions = {
    baseUrl: "/api/auth",
};

/**
 * Sign in with email and password
 */
export async function signInWithCredentials(
    credentials: SignInCredentials,
    options?: {
        redirect?: boolean;
        redirectTo?: string;
        clientOptions?: AuthClientOptions;
    }
): Promise<AuthResponse> {
    const { baseUrl } = { ...defaultOptions, ...options?.clientOptions };
    
    try {
        const response = await fetch(`${baseUrl}/callback/credentials`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ...credentials,
                redirect: options?.redirect ?? false,
                callbackUrl: options?.redirectTo ?? "/dashboard",
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: "Authentication failed" }));
            return {
                success: false,
                error: error.error || "Invalid credentials",
            };
        }

        const data = await response.json();
        
        if (options?.redirect) {
            return { success: true };
        }

        const session = await getSession(options?.clientOptions);
        
        return {
            success: true,
            session: session || undefined,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Authentication failed",
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
    }
): Promise<AuthResponse> {
    const { baseUrl } = { ...defaultOptions, ...options?.clientOptions };
    
    try {
        const params = new URLSearchParams();
        params.set("callbackUrl", options?.redirectTo ?? "/dashboard");
        
        const signInUrl = `${baseUrl}/signin/${providerId}?${params.toString()}`;
        
        if (typeof window !== "undefined") {
            window.location.href = signInUrl;
        }
        
        return {
            success: true,
            url: signInUrl,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to initiate OAuth sign in",
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
    }
): Promise<AuthResponse> {
    const { baseUrl } = { ...defaultOptions, ...options?.clientOptions };
    
    try {
        const response = await fetch(`${baseUrl}/signin/email`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email,
                callbackUrl: options?.redirectTo ?? "/dashboard",
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: "Failed to send magic link" }));
            return {
                success: false,
                error: error.error || "Failed to send magic link",
            };
        }

        return {
            success: true,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to send magic link",
        };
    }
}

/**
 * Get the current session
 */
export async function getSession(
    options?: AuthClientOptions
): Promise<AuthSession | null> {
    const { baseUrl } = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(`${baseUrl}/session`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            return null;
        }

        const session = await response.json();
        
        if (!session || !session.user) {
            return null;
        }

        return session as AuthSession;
    } catch (error) {
        console.error("Failed to get session:", error);
        return null;
    }
}

/**
 * Sign out the current user
 */
export async function signOut(
    options?: {
        redirectTo?: string;
        clientOptions?: AuthClientOptions;
    }
): Promise<AuthResponse> {
    const { baseUrl } = { ...defaultOptions, ...options?.clientOptions };
    
    try {
        const params = new URLSearchParams();
        if (options?.redirectTo) {
            params.set("callbackUrl", options.redirectTo);
        }
        
        const response = await fetch(`${baseUrl}/signout?${params.toString()}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            return {
                success: false,
                error: "Failed to sign out",
            };
        }

        return {
            success: true,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to sign out",
        };
    }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(
    options?: AuthClientOptions
): Promise<boolean> {
    const session = await getSession(options);
    return session !== null;
}

/**
 * Get CSRF token for forms
 */
export async function getCsrfToken(
    options?: AuthClientOptions
): Promise<string | null> {
    const { baseUrl } = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(`${baseUrl}/csrf`);
        const data = await response.json();
        return data.csrfToken || null;
    } catch (error) {
        console.error("Failed to get CSRF token:", error);
        return null;
    }
}
