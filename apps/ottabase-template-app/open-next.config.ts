import type { OpenNextConfig } from '@opennextjs/cloudflare';

const config: OpenNextConfig = {
  default: {
    // Use Cloudflare Workers runtime
    override: {
      wrapper: 'cloudflare-node',
    },
  },
};

export default config;
