// ============================================================
// Auth.js API Route Handler
// ============================================================
//
// This route handles all Auth.js authentication endpoints:
// - /api/auth/signin
// - /api/auth/signout
// - /api/auth/callback/*
// - /api/auth/session
// - /api/auth/csrf
// - etc.
//
// For Next.js App Router with Auth.js v5
// Reference: https://authjs.dev/getting-started/installation?framework=Next.js
// ============================================================

import { GET, POST } from "@/app/auth";

// Export the GET and POST handlers from auth configuration
export { GET, POST };

export const runtime = "edge"; // Use Edge Runtime for Cloudflare Workers compatibility
