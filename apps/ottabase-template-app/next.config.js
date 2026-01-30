/** @type {import('next').NextConfig} */

const path = require('path');

const { initOpenNextCloudflareForDev } = require('@opennextjs/cloudflare');

// Initialize OpenNext Cloudflare for local development
initOpenNextCloudflareForDev();

const isWindows = process.platform === 'win32';
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const forceStandalone = process.env.NEXT_OUTPUT === 'standalone' || process.env.NEXT_OUTPUT_STANDALONE === 'true';

// Next.js standalone output copies dependencies into `.next/standalone/**`.
// On Windows this often involves creating symlinks, which can fail (EPERM)
// unless Developer Mode / elevated privileges are enabled.
//
// We default to NOT using standalone on Windows for local builds, but always
// keep it for CI (Linux) so OpenNext packaging works.
const shouldUseStandaloneOutput = forceStandalone || !isWindows || isCI;

const nextConfig = {
    // Required for OpenNext packaging (creates `.next/standalone/**`)
    output: shouldUseStandaloneOutput ? 'standalone' : undefined,

    // Monorepo: ensure Next can trace files outside the app directory
    // so CI/OpenNext packaging consistently includes workspace dependencies.
    outputFileTracingRoot: path.resolve(__dirname, '../../'),

    // Enable transpilation of packages
    transpilePackages: [
        '@ottabase/ui-core',
        '@ottabase/cf',
        '@ottabase/cf-realtime',
        '@ottabase/config',
        '@ottabase/state',
        '@ottabase/ui-code-highlight',
        '@ottabase/ui-tailwind',
        '@ottabase/ui-components',
        '@ottabase/utils',
        '@ottabase/db',
    ],

    // Enable React strict mode
    reactStrictMode: true,

    // TypeScript configuration
    typescript: {
        // !! WARN !!
        // Dangerously allow production builds to successfully complete even if
        // your project has type errors.
        // TODO: Remove this once React 19 type compatibility issues are resolved
        ignoreBuildErrors: false,
    },

    // Experimental features for Next.js 15
    experimental: {
        // Add any Next.js 15 experimental features here
        cssChunking: true, // default true
        optimizeCss: true, // default true
        optimizePackageImports: [
            '@ottabase/ui-base',
            '@ottabase/cf',
            '@ottabase/cf-realtime',
            '@ottabase/config',
            '@ottabase/state',
            '@ottabase/ui-code-highlight',
            '@ottabase/ui-tailwind',
            '@ottabase/ui-components',
            '@ottabase/utils',
            '@ottabase/db',
        ],
    },
    compiler: {
        // Enables the styled-components SWC transform
        // Warning: Prop `className` did not match. Server: "mantine-xxx mantine-Switch-track" Client: "mantine-yyy mantine-Switch-track"
        styledComponents: true,
    },
    devIndicators: {
        position: 'bottom-right',
    },
    images: {
        unoptimized: true, // Disable Cloudflare Images optimization
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
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
    allowedDevOrigins: [...(process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(',') ?? [])],
    serverExternalPackages: [
        'fs', // For Email Templates compiler
    ],

    // Turbopack configuration (Next.js 16+)
    // Empty config to acknowledge Turbopack is being used
    turbopack: {},

    // Webpack configuration (fallback for --webpack flag)
    webpack: (config, { isServer, webpack }) => {
        // Handle Cloudflare-specific imports that aren't available during build
        // These are only available in the Cloudflare Workers runtime
        if (isServer) {
            // Add plugin to replace cloudflare: imports with empty stubs
            config.plugins.push(
                new webpack.NormalModuleReplacementPlugin(/^cloudflare:(.*)$/, (resource) => {
                    // Replace cloudflare: imports with an empty module
                    resource.request = require.resolve('./cloudflare-stub.js');
                }),
            );
        }

        // Configure webpack watching to avoid Windows-specific errors
        config.watchOptions = {
            ...config.watchOptions,
            // Ignore Watchpack errors for CSS files (known Windows issue)
            ignored: config.watchOptions?.ignored || /node_modules/,
        };

        // Suppress Watchpack ENOTDIR errors (Windows-specific CSS file watching issue)
        config.infrastructureLogging = {
            ...config.infrastructureLogging,
            level: 'error',
        };

        return config;
    },
};

module.exports = nextConfig;
