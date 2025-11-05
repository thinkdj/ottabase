/**
 * Custom worker entry point for Cloudflare
 * This file exports Durable Object classes alongside the Next.js app
 */

// Re-export RealtimeActor Durable Object for Cloudflare bindings
export { RealtimeActor } from '@ottabase/cf-realtime/server';
