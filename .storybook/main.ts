import type { StorybookConfig } from '@storybook/react-webpack5';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveStorybookEntries } from './story-sources.ts';
import webpack from 'webpack';

const { stories, staticDirs, scope } = resolveStorybookEntries();

// Define __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const storybookPostCssConfig = path.resolve(__dirname, 'postcss.config.cjs');
const storybookTailwindConfig = path.resolve(__dirname, 'tailwind.config.cjs');
const defaultTailwindConfig = path.resolve(projectRoot, 'apps/ottabase-template-app/tailwind.config.cjs');

// Use Storybook-specific Tailwind config by default
if (!process.env.TAILWIND_CONFIG) {
    process.env.TAILWIND_CONFIG = storybookTailwindConfig;
}

if (process.env.DEBUG || process.env.STORYBOOK_DEBUG_SCOPE) {
    // eslint-disable-next-line no-console
    console.info('[storybook] packages:', scope.selectedPackages.map((pkg) => pkg.dirName).join(', ') || 'none');
    // eslint-disable-next-line no-console
    console.info('[storybook] apps:', scope.selectedApps.map((app) => app.dirName).join(', ') || 'none');
    // eslint-disable-next-line no-console
    console.info('[storybook] primary app alias "@":', scope.primaryApp ? scope.primaryApp.dirName : 'unset');
}

const config: StorybookConfig = {
    stories,
    staticDirs,
    addons: [
        getAbsolutePath('@storybook/addon-links'),
        {
            name: getAbsolutePath('@storybook/addon-styling-webpack'),
            options: {
                rules: [
                    {
                        test: /\.css$/,
                        sideEffects: true,
                        use: [
                            'style-loader',
                            {
                                loader: 'css-loader',
                                options: {
                                    importLoaders: 1,
                                },
                            },
                            {
                                loader: 'postcss-loader',
                                options: {
                                    postcssOptions: {
                                        config: storybookPostCssConfig,
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        },
        getAbsolutePath('@storybook/addon-docs'),
    ],
    framework: {
        name: getAbsolutePath('@storybook/react-webpack5'),
        options: {},
    },
    docs: {
        defaultName: 'Documentation',
    },
    typescript: {
        check: false,
    },
    core: {
        disableTelemetry: true,
    },
    async webpackFinal(config) {
        config.resolve = config.resolve || {};
        config.resolve.alias = { ...(config.resolve.alias ?? {}) };

        /// ================ TEMPORARY WORKAROUND ================
        // Force single React version to prevent ReactSharedInternals conflicts
        const reactPath = path.resolve(projectRoot, 'node_modules/.pnpm/react@18.3.1/node_modules/react');
        const reactDomPath = path.resolve(
            projectRoot,
            'node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom',
        );

        config.resolve.alias['react'] = reactPath;
        config.resolve.alias['react-dom'] = reactDomPath;
        config.resolve.alias['react/jsx-runtime'] = path.resolve(reactPath, 'jsx-runtime.js');
        config.resolve.alias['react/jsx-dev-runtime'] = path.resolve(reactPath, 'jsx-dev-runtime.js');
        /// ================ /TEMPORARY WORKAROUND ================

        // Add fallbacks for Node.js modules
        config.resolve.fallback = {
            ...config.resolve.fallback,
            process: false,
            buffer: false,
        };

        // Add simple process polyfill using DefinePlugin
        config.plugins = config.plugins || [];
        config.plugins.push(
            new webpack.DefinePlugin({
                'process.env': JSON.stringify({}),
                'process.browser': JSON.stringify(true),
                'process.version': JSON.stringify(''),
                'process.platform': JSON.stringify('browser'),
            }),
        );

        if (scope.primaryApp) {
            config.resolve.alias['@'] = scope.primaryApp.root;
        }

        const nextFontMock = path.resolve(__dirname, './next-font-mock.js');
        config.resolve.alias['next/font/google'] = nextFontMock;
        config.resolve.alias['next/font/local'] = nextFontMock;

        scope.selectedApps.forEach((app) => {
            const aliasKey = `@apps/${app.dirName}`;
            if (!config.resolve.alias[aliasKey]) {
                config.resolve.alias[aliasKey] = app.root;
            }
        });

        // ================ WORKSPACE ALIASES ================
        //
        // 📚 DEVELOPER GUIDE - How to maintain workspace aliases:
        // 1. ADD NEW ALIAS: Simply add an entry to workspacePackageAliases array
        //    Format: [aliasName, packagePath, subPath (optional)]
        // 2. EXAMPLES:
        //    ["@ottabase/my-package", "packages/my-package", "src"]            // → packages/my-package/src
        //    ["@ottabase/my-package/styles", "packages/my-package", "styles"]  // → packages/my-package/styles
        //    ["@ottabase/my-package", "packages/my-package"]                   // → packages/my-package (root)
        // 3. The system automatically:
        //    - Resolves paths relative to project root
        //    - Converts to webpack alias format
        //    - Groups by package type for easier maintenance
        // ================================================================

        const workspacePackageAliases: Array<[string, string, string?]> = [
            // ============ CORE PACKAGES ============
            ['@ottabase/config', 'packages/config', 'src'],
            ['@ottabase/state', 'packages/state', 'src'],
            ['@ottabase/utils', 'packages/utils', 'src'],
            ['@ottabase/scripts', 'packages/scripts', 'src'],
            // ============ UI PACKAGES ============
            // Main UI packages
            ['@ottabase/ui-core', 'packages/ui-core', 'src'],
            ['@ottabase/ui-components', 'packages/ui-components', 'src'],
            ['@ottabase/ui-code-highlight', 'packages/ui-code-highlight', 'src'],
            ['@ottabase/ui-shadcn', 'packages/ui-shadcn', 'src'],
            // UI Core sub-exports
            ['@ottabase/ui-core/styles', 'packages/ui-core', 'styles'],
            ['@ottabase/ui-core/themes', 'packages/ui-core', 'themes'],
            ['@ottabase/ui-core/provider', 'packages/ui-core', 'provider'],
            // Tailwind UI
            ['@ottabase/ui-tailwind', 'packages/ui-tailwind', 'src'],
            ['@ottabase/ui-tailwind/styles', 'packages/ui-tailwind', 'styles'],
            // ============ DATABASE PACKAGES ============
            ['@ottabase/db', 'packages/db', 'src'],
            // ============ EXAMPLE PACKAGES ============
            ['@ottabase/hello-world', 'packages/hello-world', 'src'],
        ];

        // Convert package aliases to webpack alias format
        const workspaceAliases: Record<string, string> = {};

        workspacePackageAliases.forEach(([alias, packagePath, subPath]) => {
            const fullPath = subPath
                ? path.resolve(projectRoot, packagePath, subPath)
                : path.resolve(projectRoot, packagePath);
            workspaceAliases[alias] = fullPath;
        });

        Object.entries(workspaceAliases).forEach(([key, value]) => {
            if (!config.resolve?.alias) {
                config.resolve!.alias = {};
            }
            if (!(config.resolve.alias as Record<string, string>)[key]) {
                (config.resolve.alias as Record<string, string>)[key] = value;
            }
        });

        config.module = config.module || {};
        config.module.rules = config.module.rules || [];

        config.module.rules.forEach((rule) => {
            const uses = Array.isArray(rule.use) ? rule.use : rule.use ? [rule.use] : [];

            uses.forEach((useEntry) => {
                if (
                    useEntry &&
                    typeof useEntry === 'object' &&
                    'loader' in useEntry &&
                    typeof useEntry.loader === 'string' &&
                    useEntry.loader.includes('postcss-loader')
                ) {
                    useEntry.options = {
                        ...(useEntry.options || {}),
                        postcssOptions: {
                            ...(useEntry.options?.postcssOptions || {}),
                            config: storybookPostCssConfig,
                        },
                    };
                }
            });
        });

        config.module.rules.push({
            test: /\.[jt]sx?$/,
            include: [path.resolve(projectRoot, 'packages'), path.resolve(projectRoot, 'apps'), __dirname],
            exclude: /node_modules/,
            use: [
                {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            '@babel/preset-env',
                            ['@babel/preset-react', { runtime: 'automatic' }],
                            '@babel/preset-typescript',
                        ],
                    },
                },
            ],
        });

        scope.selectedPackages.forEach((pkg) => {
            const aliasKey = `@packages/${pkg.dirName}`;
            if (!config.resolve.alias[aliasKey]) {
                config.resolve.alias[aliasKey] = pkg.root;
            }
        });

        config.resolve.extensions = Array.from(
            new Set([...(config.resolve.extensions ?? []), '.ts', '.tsx', '.js', '.jsx']),
        );

        config.stats = {
            ...(config.stats ?? {}),
            children: true,
            errorDetails: true,
        };

        return config;
    },
};

export default config;

function getAbsolutePath(value: string): any {
    return path.join(__dirname, '../node_modules', value);
}
