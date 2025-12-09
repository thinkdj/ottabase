// ============================================================
// Authentication Configuration
// ============================================================
//
// This file contains the complete Auth.js configuration for the application.
// It uses @ottabase/auth package for D1 adapter and provider presets.
//
// This configuration is framework-agnostic and can be used with any
// Auth.js compatible framework (Next.js, Remix, SvelteKit, etc.)
//
// ============================================================

import type { NextAuthConfig } from "next-auth";
import { createOttabaseAuthConfig } from "@ottabase/auth/config";
import { autoConfigureProviders } from "@ottabase/auth/providers";

/**
 * Create the Auth.js configuration for the application
 *
 * This function is called with the runtime environment (from Cloudflare Workers)
 * and returns a complete Auth.js configuration.
 */
export default function createAuthConfig(env: any): NextAuthConfig {
  return createOttabaseAuthConfig({
    // ============================================================
    // DATABASE
    // ============================================================
    d1: env.DB,

    // ============================================================
    // PROVIDERS
    // ============================================================
    // Auto-configure based on environment variables
    providers: autoConfigureProviders(env),

    // Or manually configure specific providers:
    // providers: [
    //   createGoogleProvider(env),
    //   createGitHubProvider(env),
    //   createDiscordProvider(env),
    // ],

    // ============================================================
    // ORM CONFIGURATION
    // ============================================================
    // Use Drizzle for D1 (recommended for edge/serverless)
    orm: "drizzle", // or "prisma" for legacy support

    // ============================================================
    // SESSION CONFIGURATION
    // ============================================================
    // JWT sessions are recommended for Cloudflare Workers/Edge Runtime
    sessionStrategy: "jwt", // or "database" for database-backed sessions

    // Session expires after 30 days of inactivity
    sessionMaxAge: 30 * 24 * 60 * 60, // 30 days

    // ============================================================
    // PERFORMANCE
    // ============================================================
    // Use cached adapter for better performance in production
    useCachedAdapter: true,

    // ============================================================
    // LOGGING
    // ============================================================
    // Enable logging in development
    log: env.NODE_ENV === "development" ? ["error", "warn"] : false,

    // ============================================================
    // ADDITIONAL AUTH.JS CONFIGURATION
    // ============================================================
    authConfig: {
      // Trust host for Cloudflare Workers deployment
      trustHost: true,

      // ============================================================
      // CUSTOM PAGES
      // ============================================================
      // Uncomment to use custom authentication pages
      // pages: {
      //   signIn: "/auth/signin",
      //   signOut: "/auth/signout",
      //   error: "/auth/error",
      //   verifyRequest: "/auth/verify-request",
      // },

      // ============================================================
      // CALLBACKS
      // ============================================================
      callbacks: {
        // Sign-in callback - runs when user attempts to sign in
        async signIn({ user, account, profile }) {
          console.log("[Auth] Sign-in attempt:", {
            userId: user?.id,
            provider: account?.provider,
            timestamp: new Date().toISOString(),
          });

          // Example: Block sign-ins based on environment variable
          if (env.AUTH_DISABLE_SIGNINS === "true") {
            console.warn("[Auth] Sign-ins are disabled via AUTH_DISABLE_SIGNINS");
            return false;
          }

          // Allow sign-in
          return true;
        },

        // JWT callback - runs when JWT is created or updated
        async jwt({ token, user, account, profile, trigger }) {
          // On first sign-in, add user data to token
          if (user) {
            token.userId = user.id;
            token.email = user.email;
          }

          console.log("[Auth] JWT callback:", {
            userId: token.userId,
            trigger,
          });

          return token;
        },

        // Session callback - runs when session is checked
        async session({ session, token, user }) {
          // Add custom fields to session from JWT token
          if (token?.userId) {
            session.user = {
              ...session.user,
              id: token.userId as string,
            };
          }

          console.log("[Auth] Session callback:", {
            userId: session.user?.id,
          });

          return session;
        },

        // Redirect callback - controls where user is redirected after auth
        async redirect({ url, baseUrl }) {
          console.log("[Auth] Redirect:", { url, baseUrl });

          // If url is a relative path, convert to absolute
          if (url.startsWith("/")) {
            return `${baseUrl}${url}`;
          }

          // If url matches baseUrl domain, allow it
          if (url.startsWith(baseUrl)) {
            return url;
          }

          // Otherwise redirect to baseUrl for security
          return baseUrl;
        },
      },

      // ============================================================
      // EVENTS
      // ============================================================
      events: {
        async signIn(message) {
          console.log("[Auth] User signed in:", {
            user: message.user?.id,
            account: message.account?.provider,
          });
        },

        async signOut(message) {
          console.log("[Auth] User signed out:", message);
        },

        async createUser(message) {
          console.log("[Auth] User created:", {
            userId: message.user?.id,
          });
        },

        async linkAccount(message) {
          console.log("[Auth] Account linked:", {
            userId: message.user?.id,
            provider: message.account?.provider,
          });
        },

        async session(message) {
          // Note: This fires frequently, so keep logging minimal
          // console.log("[Auth] Session checked");
        },
      },

      // ============================================================
      // COOKIES
      // ============================================================
      cookies: {
        sessionToken: {
          name: `__Secure-next-auth.session-token`,
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: env.NODE_ENV === "production",
          },
        },
        csrfToken: {
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: env.NODE_ENV === "production",
          },
        },
      },

      // Use secure cookies in production
      useSecureCookies: env.NODE_ENV === "production",
    },
  });
}
