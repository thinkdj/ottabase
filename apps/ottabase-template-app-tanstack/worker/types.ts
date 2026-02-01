/**
 * Shared type definitions for the worker
 */

// CloudflareEnv is typically defined globally in worker-next.d.ts
// This file can be extended with additional types as needed

export type RouteHandler = (
    request: Request,
    env: CloudflareEnv,
    url: URL,
) => Promise<Response> | Response | Promise<Response | null> | Response | null;
