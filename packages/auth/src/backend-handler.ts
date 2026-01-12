// ============================================================
// @ottabase/auth - Backend Request Handler
// ============================================================
//
// Production-ready Auth.js request handler for Cloudflare Workers.
// This module provides plug-and-play authentication for any Worker.
//
// Usage in cloudflare-worker.ts:
//   import { handleAuthRequest } from "@ottabase/auth/backend";
//
//   if (url.pathname.startsWith("/api/auth/")) {
//     return handleAuthRequest(request, env);
//   }
//
// ============================================================

import { Auth, type AuthConfig } from "@auth/core";
import type { D1Database } from "@cloudflare/workers-types";
import { createOttabaseAuthConfig } from "./config";
import type { ProviderEnv } from "./providers";
import {
  autoConfigureProviders,
  createCredentialsProvider,
  createNodemailerProvider,
  createResendProvider,
} from "./providers";

/**
 * Environment interface for auth handler
 * Your CloudflareEnv should extend this
 */
export interface AuthEnv extends ProviderEnv {
  AUTH_SECRET?: string;
  OBCF_D1?: D1Database;
}

/**
 * Options for credentials authorization callback
 */
export interface CredentialsAuthorizeOptions {
  /**
   * Custom authorization function
   * Return user object on success, null on failure
   */
  authorize?: (credentials: { email: string; password: string }) => Promise<{
    id: string;
    email: string;
    name?: string;
    [key: string]: any;
  } | null>;

  /**
   * Minimum password length (default: 6)
   */
  minPasswordLength?: number;
}

/**
 * Default credentials authorization (demo/placeholder)
 * In production, override with your own validation logic
 */
async function defaultCredentialsAuthorize(
  credentials: { email: string; password: string },
  options?: CredentialsAuthorizeOptions,
): Promise<any> {
  const { email, password } = credentials;
  const minLength = options?.minPasswordLength ?? 6;

  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  // Validate password length
  if (password.length < minLength) {
    throw new Error(`Password must be at least ${minLength} characters`);
  }

  // TODO: Replace with database query in production
  // Example production code:
  // const db = drizzle(env.OBCF_D1);
  // const user = await db.select().from(User).where(eq(User.email, email)).get();
  // if (!user || !await verifyPassword(password, user.passwordHash)) {
  //     return null;
  // }
  // return { id: user.id, email: user.email, name: user.name };

  // Demo: Accept any valid-format login
  return {
    id: crypto.randomUUID(),
    email: email,
    name: email.split("@")[0],
  };
}

/**
 * Options for creating auth configuration
 */
export interface CreateAuthConfigOptions extends CredentialsAuthorizeOptions {
  /**
   * Session max age in seconds (default: 30 days)
   */
  sessionMaxAge?: number;

  /**
   * Additional Auth.js config options
   */
  authConfig?: Partial<Omit<AuthConfig, "adapter" | "providers">>;

  /**
   * Enable verbose logging
   */
  verbose?: boolean;
}

/**
 * Create Auth.js configuration with auto-configured providers
 * This is the core function that sets up authentication
 */
export function createAuthConfig(
  env: AuthEnv,
  options?: CreateAuthConfigOptions,
): AuthConfig {
  const verbose = options?.verbose ?? false;

  if (!env.OBCF_D1) {
    throw new Error("OBCF_D1 database binding is required for authentication");
  }

  if (!env.AUTH_SECRET) {
    console.warn(
      "⚠️  AUTH_SECRET is not configured. Using default (INSECURE FOR PRODUCTION!)",
    );
  }

  const providers: any[] = [];

  // Auto-configure OAuth providers
  const oauthProviders = autoConfigureProviders(env);
  providers.push(...oauthProviders);

  if (verbose && oauthProviders.length > 0) {
    console.log(
      `✅ OAuth providers: ${oauthProviders.map((p: any) => p.id).join(", ")}`,
    );
  } else if (verbose) {
    console.warn("⚠️  No OAuth providers configured");
  }

  // Configure email provider (magic link)
  if (env.RESEND_API_KEY) {
    providers.push(createResendProvider(env));
    if (verbose) console.log("✅ Magic Link via Resend enabled");
  } else if (env.EMAIL_SERVER && env.EMAIL_FROM) {
    providers.push(createNodemailerProvider(env));
    if (verbose) console.log("✅ Magic Link via SMTP enabled");
  } else if (verbose) {
    console.warn("⚠️  Magic Link not configured");
  }

  // Always include credentials provider
  providers.push(
    createCredentialsProvider(async (credentials: any) => {
      if (options?.authorize) {
        return options.authorize(credentials);
      }
      return defaultCredentialsAuthorize(credentials, options);
    }),
  );

  if (verbose) console.log("✅ Credentials authentication enabled");

  // Create the auth configuration
  const config = createOttabaseAuthConfig({
    d1: env.OBCF_D1,
    providers,
    sessionStrategy: "jwt",
    sessionMaxAge: options?.sessionMaxAge ?? 30 * 24 * 60 * 60, // 30 days
    authConfig: {
      secret: env.AUTH_SECRET || "dev-secret-change-in-production",
      /**
       * trustHost:
       *   Cloudflare Workers and other edge runtimes often require `trustHost: true`
       *   because the framework cannot reliably infer the public origin from the
       *   incoming request (e.g. behind proxies / custom domains). In those
       *   environments, Auth.js host checks would otherwise fail.
       *
       *   Security note:
       *   - Enabling `trustHost` bypasses Auth.js' built‑in host validation and
       *     makes this handler trust the host information provided by the platform.
       *   - If your Cloudflare route / custom domain configuration is misconfigured
       *     or if arbitrary Host headers are allowed to reach the Worker, this can
       *     enable host‑header based attacks.
       *
       *   Recommended hardening:
       *   - Configure a canonical external URL for your deployment (e.g. via
       *     an `AUTH_URL`/`NEXTAUTH_URL` or similar env var at the application
       *     level) and ensure Cloudflare only routes from trusted hostnames.
       *   - Do NOT expose this Worker on untrusted / wildcard hosts without
       *     additional protections.
       *
       *   Overrides / alternatives:
       *   - If your environment does not require bypassing host checks, you can
       *     override this setting via `options.authConfig.trustHost = false` and
       *     configure Auth.js with an explicit `url` / allowed hosts.
       */
      trustHost: true,
      callbacks: {
        async jwt({ token, user }) {
          if (user) {
            token.id = user.id;
            token.email = user.email;
            token.name = user.name;
          }
          return token;
        },
        async session({ session, token }) {
          if (session.user) {
            session.user.id = token.id as string;
            session.user.email = token.email as string;
            session.user.name = token.name as string;
          }
          return session;
        },
      },
      ...options?.authConfig,
    },
  });

  return config;
}

/**
 * Handle Auth.js requests in Cloudflare Workers
 *
 * This is the main entry point for authentication in your Worker.
 * Call this for any request to /api/auth/*
 *
 * @example
 * ```typescript
 * // In cloudflare-worker.ts
 * import { handleAuthRequest } from "@ottabase/auth/backend";
 *
 * if (url.pathname.startsWith("/api/auth/")) {
 *   return handleAuthRequest(request, env);
 * }
 * ```
 */
export async function handleAuthRequest(
  request: Request,
  env: AuthEnv,
  options?: CreateAuthConfigOptions,
): Promise<Response> {
  try {
    const config = createAuthConfig(env, options);
    return await Auth(request, config);
  } catch (error) {
    console.error("Auth request error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Authentication error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Get session from request
 *
 * @example
 * ```typescript
 * const session = await getSession(request, env);
 * if (!session) {
 *   return new Response("Unauthorized", { status: 401 });
 * }
 * ```
 */
export async function getSession(
  request: Request,
  env: AuthEnv,
  options?: CreateAuthConfigOptions,
) {
  try {
    const config = createAuthConfig(env, options);

    const url = new URL(request.url);
    url.pathname = "/api/auth/session";

    const sessionRequest = new Request(url.toString(), {
      method: "GET",
      headers: request.headers,
    });

    const response = await Auth(sessionRequest, config);

    if (response.ok) {
      return await response.json();
    }

    return null;
  } catch (error) {
    console.error("Get session error:", error);
    return null;
  }
}

/**
 * Simple password hashing using Web Crypto API
 * For production, consider using bcrypt or argon2
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}
