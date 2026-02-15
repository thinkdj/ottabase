import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// Resolve __dirname in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BYPASS_PATHS = ['/api', '/shortlinks/go', '/__bootstrap__'];

/**
 * SPA fallback plugin – ensures that any non‑API request that expects HTML
 * serves `index.html`. This enables proper client‑side routing on page reloads
 * (F5) or direct navigation to nested routes.
 */
function spaFallback(): Plugin {
    return {
        name: 'spa-fallback',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const url = req.url || '';
                // Bypass API, Bootstrap, and Redirect routes
                if (BYPASS_PATHS.some((p) => url.startsWith(p))) return next();
                // Strip query/fragment and check for a file extension
                const pathname = url.split(/[?#]/)[0];
                const isFile = pathname.includes('.');
                // If it's not a file and the client expects HTML, rewrite to index.html
                if (!isFile && req.headers.accept?.includes('text/html')) {
                    req.url = '/index.html';
                }
                next();
            });
        },
    };
}

export default defineConfig(({ command }) => ({
    // Base URL – keep it relative for most deployments
    base: '/',
    plugins: [
        tsconfigPaths({
            projects: [path.resolve(__dirname, './tsconfig.json')],
            ignoreConfigErrors: true,
        }),
        // React plugin with SWC for fast transforms and automatic Fast Refresh
        react({
            // Enable the new JSX runtime and fast refresh
            jsxRuntime: 'automatic',
        }),
        spaFallback(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@ottabase/rbac/admin-guard': path.resolve(__dirname, '../../packages/rbac/src/admin-guard.ts'),
            '@ottabase/rbac/request-context': path.resolve(__dirname, '../../packages/rbac/src/request-context.ts'),
            // Stub @sentry/node in browser build so Vite never bundles it (it uses node:inspector).
            // Logger's SentryTransport will catch and try @sentry/browser or show optional warning.
            '@sentry/node': path.resolve(__dirname, './src/stubs/sentry-node-stub.ts'),
        },
    },
    optimizeDeps: {
        include: ['react/jsx-runtime', 'react/jsx-dev-runtime'],
        // Do not pre-bundle Sentry node; we alias it to a stub in browser
        exclude: ['@sentry/node'],
        esbuildOptions: {
            target: 'esnext',
        },
    },
    esbuild: {
        target: 'esnext',
        legalComments: 'none',
        treeShaking: true,
        // Drop console/debugger only in production build so logger demo works in dev
        ...(command === 'build' ? { drop: ['console', 'debugger'] as const } : {}),
    },
    logLevel: 'info',
    build: {
        outDir: 'dist',
        sourcemap: false,
        // Security‑focused minification
        minify: 'esbuild',
        cssMinify: true,
        cssTarget: 'esnext',
        target: 'esnext',
        // Smaller chunks improve caching and initial load
        chunkSizeWarningLimit: 1500,
        assetsInlineLimit: 96 * 1024, // 96 KB – keep small assets inlined
        cssCodeSplit: true,
        // Enable module preload polyfill for better HTTP/2 performance
        modulePreload: { polyfill: true },
        commonjsOptions: { transformMixedEsModules: true },
        rollupOptions: {
            output: {
                manualChunks: {
                    mantine: [
                        '@mantine/core',
                        '@mantine/hooks',
                        '@mantine/modals',
                        '@mantine/notifications',
                        '@mantine/carousel',
                    ],
                    tanstack: ['@tanstack/react-query', '@tanstack/react-query-devtools', '@tanstack/react-router'],
                    ottaeditor: ['@ottabase/ottaeditor'],
                },
            },
            onwarn(warning) {
                // Suppress ignored-bare-import warnings from @ottabase/* packages...
                if (warning.message.includes('ignored-bare-import')) return;
                console.warn(warning.message);
            },
        },
    },
    server: {
        host: '127.0.0.1',
        port: parseInt(process.env.PORT_FE || '3003'),
        strictPort: true,
        // Proxy API calls to the backend worker
        proxy: Object.fromEntries(
            BYPASS_PATHS.map((p) => [
                p,
                {
                    target: `http://127.0.0.1:${process.env.PORT_BE || 3004}`,
                    changeOrigin: true,
                    secure: false,
                },
            ]),
        ),
        // Harden the dev server – disallow serving files outside the project root
        fs: { strict: true },
    },
    preview: {
        port: 4173,
    },
}));
