/** @type {import('next').NextConfig} */

const nextConfig = {
  // Enable transpilation of packages
  transpilePackages: [
    "@ottabase/ui-core",
    "@ottabase/cf",
    "@ottabase/config",
    "@ottabase/state",
    "@ottabase/ui-code-highlight",
    "@ottabase/ui-tailwind",
    "@ottabase/ui-components",
    "@ottabase/utils",
    "@ottabase/db",
  ],

  // Enable React strict mode
  reactStrictMode: true,

  // Optimize images
  images: {
    remotePatterns: [],
  },

  // Experimental features for Next.js 15
  experimental: {
    // Add any Next.js 15 experimental features here
    cssChunking: true, // default true
    optimizeCss: true, // default true
    optimizePackageImports: [
      "@ottabase/ui-core",
      "@ottabase/cf",
      "@ottabase/config",
      "@ottabase/state",
      "@ottabase/ui-code-highlight",
      "@ottabase/ui-tailwind",
      "@ottabase/ui-components",
      "@ottabase/utils",
      "@ottabase/db",
    ],
  },
  compiler: {
    // Enables the styled-components SWC transform
    // Warning: Prop `className` did not match. Server: "mantine-xxx mantine-Switch-track" Client: "mantine-yyy mantine-Switch-track"
    styledComponents: true,
  },
  devIndicators: {
    position: "bottom-right",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Next.js 15
  // swcMinify: true,
  sassOptions: {
    //silenceDeprecations: ["legacy-js-api"], // Migrated SaaS
  },
  // Allowed development origins for API routes
  // e.g.: '*.local-origin.dev'
  // If using tunnels (e.g., ngrok.io) or other custom dev TLDs, you can add them via NEXT_ALLOWED_DEV_ORIGINS (comma separated)
  allowedDevOrigins: [
    ...(process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",") ?? []),
  ],
  serverExternalPackages: [
    "fs", // For Email Templates compiler
  ],
};

module.exports = nextConfig;
