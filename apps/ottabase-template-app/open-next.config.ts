import type { OpenNextConfig } from '@opennextjs/cloudflare';

const config: OpenNextConfig = {
  default: {
    // Use Cloudflare Workers runtime
    override: {
      wrapper: 'cloudflare-node',
    },
  },
  // Export Durable Object classes
  buildCommand: 'echo "Building with Durable Objects support"',
};

// Export Durable Object classes for Cloudflare
// These need to be available at the worker entry point
export { RealtimeActor } from '@ottabase/cf-realtime/server';

export default config;
