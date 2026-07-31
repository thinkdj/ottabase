// ============================================================
// Ottabase - Root ESLint Flat Config (ESLint v9)
// ============================================================
//
// Single source of truth for linting every workspace. ESLint resolves this file
// by walking up from each package's cwd, so packages do NOT need their own
// config -- and should not add one, because a local config shadows this file and
// silently opts the package out of the framework invariants below.
//
// The "Framework invariants" section encodes rules that AGENTS.MD used to state
// only in prose. Prose did not hold: `errorResponse(...)` has been an Always-On
// Rule for months and hand-rolled JSON error responses still shipped. Anything
// an agent must never do should live here, where the toolchain rejects it.
//
// Adding a rule? Also add a one-line pointer in AGENTS.MD -> "Enforced by lint",
// and keep the prose short. The docs describe judgement; this file describes law.
//
// ============================================================

import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import storybook from 'eslint-plugin-storybook';

// ============================================================
// Path groups
// ============================================================

/** Browser/client code. Must reach the network through the provider client. */
const CLIENT_GLOBS = ['apps/*/src/**/*.{ts,tsx}'];

/** Edge/server code: Workers, route handlers, and framework package sources. */
const SERVER_GLOBS = ['apps/*/worker/**/*.ts', 'apps/*/cloudflare-worker.ts', 'packages/*/src/**/*.{ts,tsx}'];

/** Node-only tooling. Genuinely allowed to use `process`, raw responses, etc. */
const TOOLING_GLOBS = [
    'packages/scripts/**',
    'packages/cli/**',
    'packages/docs/**',
    '**/*.config.{ts,js,cjs,mjs}',
    '**/scripts/**',
];

const TEST_GLOBS = ['**/__tests__/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/*.stories.{ts,tsx}'];

// ============================================================
// Framework invariants (selectors)
// ============================================================

/**
 * Hand-rolled JSON error responses drift from the canonical error contract:
 * they miss the stable `code`, `Cache-Control: no-store`, and the 5xx redaction
 * that `errorResponse()` applies by default.
 */
const NO_HANDROLLED_JSON_RESPONSE = {
    selector:
        "NewExpression[callee.name='Response'] > CallExpression[callee.object.name='JSON'][callee.property.name='stringify']",
    message:
        'Use errorResponse()/jsonResponse() from @ottabase/utils instead of new Response(JSON.stringify(...)). Hand-rolled responses bypass the stable error code, no-store caching, and 5xx redaction.',
};

/**
 * Cloudflare Workers have no `process`. Edge config must come from the env
 * binding via the config loader, not from a build-time global.
 */
const NO_PROCESS_ENV = {
    selector: "MemberExpression[object.name='process'][property.name='env']",
    message:
        'process.env is not available in the Cloudflare Workers runtime. Read configuration from the env binding (getOttabaseConfig(env)) instead.',
};

const SERVER_SYNTAX_RULES = [NO_HANDROLLED_JSON_RESPONSE, NO_PROCESS_ENV];

// ============================================================
// Local plugin: Ottabase-specific rules
// ============================================================
//
// Home for invariants that generic ESLint rules cannot express. `no-restricted-
// syntax` carries one severity for all of its selectors, so anything that needs
// its own severity lives here rather than being folded in above.

const RAW_ERROR_LOG_SELECTOR =
    "CallExpression[callee.object.name='console'][callee.property.name=/^(error|warn|log|info)$/] > Identifier[name=/^(err|error|e)$/]";

const ottabasePlugin = {
    rules: {
        /**
         * Logging a caught error directly can write bearer tokens, cookies,
         * connection strings, and request bodies into the log sink. Wrap it in
         * redactErrorForLog() from @ottabase/utils/http-errors.
         */
        'no-raw-error-log': {
            meta: {
                type: 'problem',
                docs: { description: 'Redact thrown values before logging them' },
                schema: [],
                messages: {
                    rawErrorLog:
                        'Wrap "{{name}}" in redactErrorForLog() from @ottabase/utils/http-errors. Raw error objects can carry tokens, cookies, and request bodies into logs.',
                },
            },
            create(context) {
                return {
                    [RAW_ERROR_LOG_SELECTOR](node) {
                        context.report({ node, messageId: 'rawErrorLog', data: { name: node.name } });
                    },
                };
            },
        },
    },
};

// ============================================================
// Config
// ============================================================

export default [
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/.turbo/**',
            '**/coverage/**',
            '**/.wrangler/**',
            '**/*.min.js',
            // Generated Cloudflare type surface - tens of thousands of lines.
            'apps/*/cloudflare-env.d.ts',
            'apps/*/worker-configuration.d.ts',
        ],
    },

    // ---- Base: every TypeScript source in the monorepo ----
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            'react-hooks': reactHooks,
            ottabase: ottabasePlugin,
        },
        rules: {
            // Registered repo-wide: hook ordering is a correctness bug, and the
            // codebase already carries `eslint-disable react-hooks/*` directives
            // that silently referenced an unregistered rule until now.
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            // TypeScript resolves identifiers; core no-undef only produces noise here.
            'no-undef': 'off',
            'no-unused-vars': 'off',
            // Hygiene, not correctness. Held at `warn` because this config is the
            // first time most of the monorepo has been linted at all, and ~60
            // pre-existing violations should not gate CI on day one. The framework
            // invariants below stay at `error` -- the ratchet list is reserved for
            // invariant debt so it stays short enough to actually shrink.
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
        },
    },

    // ---- Invariant: client code goes through the provider request client ----
    {
        files: CLIENT_GLOBS,
        rules: {
            'no-restricted-globals': [
                'error',
                {
                    name: 'fetch',
                    message:
                        'Use the framework request client instead of raw fetch: a query hook (useApiQuery/createModelHooks) for reads, useApiMutation for writes, or useApiClient() imperatively. Raw fetch skips auth headers, tenant scope, cancellation, and canonical ApiError handling.',
                },
            ],
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: '@ottabase/api',
                            importNames: ['createApiClient'],
                            message:
                                'Build the API client once in src/lib/api.ts and pass it to OttaQueryProvider. A second client gets its own auth/tenant headers and bypasses the visibility-scope boundary. Importing ApiError/isApiError is fine.',
                        },
                    ],
                },
            ],
        },
    },

    // ---- Invariant: edge/server code ----
    {
        files: SERVER_GLOBS,
        rules: {
            'no-restricted-syntax': ['error', ...SERVER_SYNTAX_RULES],
            'ottabase/no-raw-error-log': 'warn',
        },
    },

    // ---- Sanctioned implementations of the response contract ----
    // These files ARE the helpers everything else is required to call.
    {
        files: [
            'packages/utils/src/http-errors.ts',
            'packages/utils/src/http-response.ts',
            'packages/utils/src/pagination.ts',
        ],
        rules: {
            'no-restricted-syntax': ['error', NO_PROCESS_ENV],
        },
    },

    // ---- Sanctioned readers of the Node/build-time environment ----
    // The env util and the app-config builder run during build or under an
    // explicit `typeof process !== 'undefined'` guard. Everything else on the
    // edge must go through the env binding.
    {
        files: ['packages/utils/src/env.ts', 'packages/config/src/**/*.ts'],
        rules: {
            'no-restricted-syntax': ['error', NO_HANDROLLED_JSON_RESPONSE],
        },
    },

    // ---- The single sanctioned API client construction site ----
    {
        files: ['apps/*/src/lib/api.ts'],
        rules: {
            'no-restricted-imports': 'off',
        },
    },

    // ---- Node-only tooling: process/env access is legitimate here ----
    {
        files: TOOLING_GLOBS,
        rules: {
            'no-restricted-syntax': 'off',
            'ottabase/no-raw-error-log': 'off',
        },
    },

    // ---- Tests: assert against raw shapes, construct raw responses ----
    {
        files: TEST_GLOBS,
        rules: {
            'no-restricted-syntax': 'off',
            'no-restricted-globals': 'off',
            'no-restricted-imports': 'off',
            'ottabase/no-raw-error-log': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },

    // ---- Storybook ----
    ...storybook.configs['flat/recommended'],
    {
        files: ['**/*.stories.{ts,tsx}'],
        rules: {
            // Story authoring conventions, not framework invariants. Visible but
            // non-blocking so they cannot mask a real failure in CI.
            'storybook/no-renderer-packages': 'warn',
            'storybook/no-redundant-story-name': 'warn',
        },
    },

    // ============================================================
    // RATCHET: pre-existing violations
    // ============================================================
    //
    // These files predate the rule that exempts them. The list may SHRINK, never
    // grow -- a new entry is a visible config diff and must be challenged in
    // review. Do not add a new app or package here; fix the call site instead.
    //
    // Each entry below is tracked debt, not an approved pattern.
    // ============================================================

    {
        // Imperative fetch() calls written before the provider client was mandatory.
        // Fix: move to useApiQuery / useApiMutation / useApiClient().
        files: [
            'apps/otta-web/src/pages/admin/appearance/brand/brandApi.ts',
            'apps/otta-web/src/pages/admin/content/blog/AdminBlogEditorPage.tsx',
            'apps/otta-web/src/pages/admin/infrastructure/MigrationsPage.tsx',
            'apps/otta-web/src/pages/auth/LoginPage.tsx',
            'apps/otta-web/src/pages/demo/cloudflare/CloudflareR2DemoPage.tsx',
            'apps/otta-web/src/pages/demo/CodeBlockDemoPage.tsx',
        ],
        rules: { 'no-restricted-globals': 'off' },
    },
    {
        // Hand-rolled JSON responses predating the errorResponse() contract.
        // Fix: return errorResponse(...) / jsonResponse(...) from @ottabase/utils.
        files: [
            'apps/otta-web/worker/bootstrap/routes.ts',
            'apps/otta-web/worker/lib/rate-limiting.ts',
            'packages/analytics/src/server.ts',
            'packages/auth/src/backend-handler.ts',
            'packages/cf-realtime/src/server/RealtimeActor.ts',
            'packages/ottaai/src/ottaorm/handlers.ts',
            'packages/ottaorm/src/crud/index.ts',
            'packages/rbac/src/admin-guard.ts',
            'packages/rbac/src/middleware.ts',
        ],
        rules: { 'no-restricted-syntax': ['error', NO_PROCESS_ENV] },
    },
    {
        // process.env.BASE_URL as a default parameter in an edge-shipped util.
        // This is a latent runtime bug on Workers, not just a style issue.
        files: ['packages/utils/src/url.ts'],
        rules: { 'no-restricted-syntax': ['error', NO_HANDROLLED_JSON_RESPONSE] },
    },
    {
        // !! REAL BUGS, NOT STYLE !!
        //
        // These components call hooks after an early return, so the hook order
        // changes between renders. React associates state by call order, which
        // means the wrong state can be read, effects can be skipped or attached
        // to the wrong values, and the component can throw on re-render.
        //
        // They were invisible until now only because repo-wide lint never ran.
        // Each file needs its early returns moved below the hook calls (render
        // the fallback from the returned JSX instead). Fix and delete the entry.
        files: [
            'apps/otta-web/src/components/ReferralTracker.tsx',
            'packages/ottarenderer/src/components/AdvancedImage/AdvancedImage.tsx',
            'packages/ottarenderer/src/components/BeforeAfter/BeforeAfter.tsx',
            'packages/ottarenderer/src/components/ImageHotspots/ImageHotspots.tsx',
            'packages/ottarenderer/src/components/MediaEmbed.tsx',
            'packages/ottarenderer/src/components/Review.tsx',
        ],
        rules: { 'react-hooks/rules-of-hooks': 'warn' },
    },
];
