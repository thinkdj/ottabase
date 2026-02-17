/**
 * Cloudflare stub for local development
 *
 * This file provides empty exports for Cloudflare-specific modules
 * (like cloudflare:workers, cloudflare:sockets) that are only available
 * in the Cloudflare Workers runtime but not during local builds.
 *
 * During the build, webpack will replace any imports from cloudflare:*
 * with this stub module, allowing the build to succeed on local machines.
 *
 * The actual Cloudflare APIs will be available when deployed to Cloudflare Pages/Workers.
 */

// Stub classes for cloudflare:workers
export class WorkerEntrypoint {}
export class DurableObject {}
export const env = {};

// Default export
export default {
    WorkerEntrypoint,
    DurableObject,
    env,
};
