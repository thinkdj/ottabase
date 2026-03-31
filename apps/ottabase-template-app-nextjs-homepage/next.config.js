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
        '@ottabase/brand-engine',
        '@ottabase/brand-engine-react',
        '@ottabase/ui-components',
        '@ottabase/ui-shadcn',
        '@ottabase/ui-tailwind',
    ],

    // Enable React strict mode
    reactStrictMode: true,

    // TypeScript configuration
    typescript: {
        // Monorepo package source imports can surface unrelated sibling-package type
        // errors during Next.js app builds. Keep app builds unblocked here.
        ignoreBuildErrors: true,
    },

    // Experimental features for Next.js 16
    experimental: {
        cssChunking: true,
        optimizeCss: true,
        optimizePackageImports: [
            '@ottabase/brand-engine',
            '@ottabase/brand-engine-react',
            '@ottabase/ui-components',
            '@ottabase/ui-shadcn',
        ],
    },
    compiler: {
        styledComponents: false,
    },
    devIndicators: {
        position: 'bottom-right',
    },
    images: {
        unoptimized: true, // Disable Next.js image optimization (Cloudflare Workers doesn't support it)
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
    sassOptions: {},
    // Allowed development origins for API routes
    allowedDevOrigins: [...(process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(',') ?? [])],

    // Turbopack configuration (Next.js 16+)
    turbopack: {},

    // Webpack configuration (fallback for --webpack flag)
    webpack: (config, { isServer, webpack }) => {
        // Handle Cloudflare-specific imports that aren't available during build
        if (isServer) {
            config.plugins.push(
                new webpack.NormalModuleReplacementPlugin(/^cloudflare:(.*)$/, (resource) => {
                    resource.request = require.resolve('./cloudflare-stub.js');
                }),
            );
        }

        // Configure webpack watching to avoid Windows-specific errors
        config.watchOptions = {
            ...config.watchOptions,
            ignored: config.watchOptions?.ignored || /node_modules/,
        };

        // Monorepo source aliases for packages that are consumed without prebuilt dist artifacts
        config.resolve = config.resolve || {};
        config.resolve.alias = {
            ...(config.resolve.alias || {}),
            '@ottabase/ui-shadcn/lib/utils': path.resolve(__dirname, '../../packages/ui-shadcn/src/lib/utils.ts'),
            '@ottabase/ui-components/dark-mode-toggle': path.resolve(
                __dirname,
                '../../packages/ui-components/src/dark-mode-toggle.ts',
            ),
            '@ottabase/ottalayout/react': path.resolve(__dirname, '../../packages/ottalayout/src/react/index.tsx'),
        };

        config.infrastructureLogging = {
            ...config.infrastructureLogging,
            level: 'error',
        };

        return config;
    },
};

module.exports = nextConfig;
