export type PkgCat = 'core' | 'ui' | 'content' | 'business' | 'brand' | 'utils';

export type PackageEntry = {
    name: string;
    description: string;
};

export type PackageSection = {
    category: PkgCat;
    title: string;
    packages: PackageEntry[];
};

export const PACKAGE_SECTIONS: PackageSection[] = [
    {
        category: 'core',
        title: 'Core Infrastructure',
        packages: [
            {
                name: '@ottabase/ottaorm',
                description:
                    'Fat models ORM built on Drizzle. Auto-migrations, relationships, RLS, CRUD API generation. The core of Ottabase.',
            },
            {
                name: '@ottabase/auth',
                description:
                    'Auth.js v5 with Cloudflare D1 adapter. OAuth, Magic Link, and Credentials — all preconfigured.',
            },
            {
                name: '@ottabase/rbac',
                description:
                    'Role-based access control with KV-cached permissions. Supports per-org, per-app, and per-user roles.',
            },
            {
                name: '@ottabase/cf',
                description:
                    'Typed wrappers for all Cloudflare bindings: D1, KV, R2, Images, Hyperdrive, Queues, Rate Limiting.',
            },
            {
                name: '@ottabase/cf-realtime',
                description: 'WebSocket pub/sub via Durable Objects. Pusher-compatible API without the Pusher bill.',
            },
            {
                name: '@ottabase/queue',
                description:
                    'Job queue built on Cloudflare Queues. Dispatch, handlers, deduplication, chaining, and priority levels.',
            },
            {
                name: '@ottabase/db',
                description: 'Drizzle D1 driver with connection pooling and edge-optimised query helpers.',
            },
            {
                name: '@ottabase/audit',
                description:
                    'Audit logging with full change tracking, RBAC context, and queryable history. Compliance-ready.',
            },
            {
                name: '@ottabase/analytics',
                description:
                    'Cloudflare Analytics Engine wrapper. Track custom events with dimensions and metrics at edge speed.',
            },
            {
                name: '@ottabase/cron',
                description:
                    'Cron job handlers. Supports both static code-defined and database-driven scheduled tasks.',
            },
            {
                name: '@ottabase/logger',
                description:
                    'Structured logging with multiple transports. Edge-compatible, context-aware, zero overhead in prod.',
            },
        ],
    },
    {
        category: 'ui',
        title: 'UI Components',
        packages: [
            {
                name: '@ottabase/ui-shadcn',
                description:
                    'The full shadcn/ui component library, pre-configured and theme-aware. Buttons, dialogs, tables, forms.',
            },
            {
                name: '@ottabase/ui-mantine',
                description:
                    'Mantine provider with pre-built themes and dark mode. Drop in, configure once, works everywhere.',
            },
            {
                name: '@ottabase/ui-datatable',
                description:
                    'Headless TanStack Table v8 wrapper with sorting, filtering, pagination, and selection built in.',
            },
            {
                name: '@ottabase/spotlight',
                description:
                    'Command palette / spotlight search. Keyboard-driven, extensible actions, accessible. Like Raycast for your app.',
            },
            {
                name: '@ottabase/ottadate',
                description:
                    'Date picker with range selection, datetime, fuzzy dates, and timezone-aware display. No moment.js.',
            },
            {
                name: '@ottabase/ui-cropper',
                description:
                    'Vanilla JS image cropper at 3–4 KB with zero dependencies. Crop, zoom, rotate. Works anywhere.',
            },
            {
                name: '@ottabase/ui-split-pane',
                description:
                    'Resizable split-pane layout component. Drag to resize, controlled or uncontrolled, vertical or horizontal.',
            },
            {
                name: '@ottabase/ottaselect',
                description:
                    'Headless select, combobox, and multi-select. Accessible, keyboard-navigable, ARIA-compliant.',
            },
            {
                name: '@ottabase/ui-code-highlight',
                description:
                    'Syntax highlighting component with copy button. Supports 30+ languages, themes, and line numbers.',
            },
            {
                name: '@ottabase/ui-components',
                description: 'Shared UI primitives: DarkModeToggle, Logo, Avatar, Badge, and more. Framework-agnostic.',
            },
            {
                name: '@ottabase/ui-tailwind',
                description:
                    'Shared Tailwind CSS configuration with Ottabase design tokens, dark mode, and typography plugin.',
            },
            {
                name: '@ottabase/ui-base',
                description:
                    'Framework-agnostic base styles, CSS resets, and design token CSS variables for cross-app consistency.',
            },
        ],
    },
    {
        category: 'content',
        title: 'Content & Media',
        packages: [
            {
                name: '@ottabase/ottablog',
                description:
                    'Full blog/CMS engine. Posts, categories, tags, series, changelogs, docs, and pages. With a studio UI.',
            },
            {
                name: '@ottabase/ottaeditor',
                description:
                    'EditorJS wrapper with 30 plugins: headers, lists, tables, code, embeds, maps, layout, FAQ, and more.',
            },
            {
                name: '@ottabase/ottarenderer',
                description:
                    'EditorJS block renderer. Converts JSON output to React components with theming and custom block support.',
            },
            {
                name: '@ottabase/ottaupload',
                description:
                    'File uploads to Cloudflare R2 and Cloudflare Images. Progress, validation, presigned URLs, image transforms.',
            },
            {
                name: '@ottabase/medialibrary',
                description:
                    'Media library schema, API, and viewer components. Browse, search, and select uploaded assets from anywhere.',
            },
        ],
    },
    {
        category: 'business',
        title: 'Business Features',
        packages: [
            {
                name: '@ottabase/shortlinks',
                description:
                    'URL shortener with custom slugs, interstitial pages, expiry dates, and Cloudflare Analytics tracking.',
            },
            {
                name: '@ottabase/referrals',
                description:
                    'Referral tracking with first-touch attribution, click tracking via Analytics Engine, and conversion funnels.',
            },
            {
                name: '@ottabase/notifications',
                description:
                    'Multi-channel notifications: in-app (WebSocket), email, and system. Preferences, read state, batching.',
            },
            {
                name: '@ottabase/comments',
                description:
                    'Threaded comment system, polymorphic (attach to anything), nestable, reactions, moderation-ready.',
            },
            {
                name: '@ottabase/forms',
                description:
                    'Auto-generated CRUD forms from OttaORM model metadata. Field types, validation, labels — all inferred.',
            },
        ],
    },
    {
        category: 'brand',
        title: 'Brand & Layout',
        packages: [
            {
                name: '@ottabase/brand-engine',
                description:
                    'Design token engine with 8 presets. Runtime CSS variable injection, email branding, preset expansion.',
            },
            {
                name: '@ottabase/brand-engine-react',
                description:
                    'React bindings for Brand Engine. BrandProvider, LayoutResolver, useBrand() hook, theme switcher.',
            },
            {
                name: '@ottabase/ottalayout',
                description:
                    'Layout types, 10 presets, path resolver, and React slot system. From sidebar to fullscreen, covered.',
            },
            {
                name: '@ottabase/ottamenu',
                description:
                    'Menu type definitions, tree utilities, and renderers. Supports nested, flat, and dynamic menu structures.',
            },
            {
                name: '@ottabase/homepage-contract',
                description:
                    'Zod-validated API contract for homepage data. Shared between Next.js frontend and Workers backend.',
            },
        ],
    },
    {
        category: 'utils',
        title: 'Utilities',
        packages: [
            {
                name: '@ottabase/scripts',
                description:
                    'CLI tools: cf:login, cf:setup, cf:validate, db:reset, clean:*. Automates the tedious Cloudflare setup.',
            },
            {
                name: '@ottabase/email',
                description:
                    'Email templating and mailer supporting Resend, AWS SES, MailChannels, and SMTP. Edge-compatible.',
            },
            {
                name: '@ottabase/i18n',
                description:
                    'i18next wrapper with built-in support for English, Spanish, French, and German. Type-safe translations.',
            },
            {
                name: '@ottabase/cf-ai',
                description:
                    'Cloudflare AI Gateway and Workers AI wrapper. Chat, embeddings, image generation — at edge latency.',
            },
            {
                name: '@ottabase/api',
                description:
                    'Type-safe fetch wrapper with request deduplication, retry logic, and error normalisation.',
            },
            {
                name: '@ottabase/state',
                description:
                    'Jotai atoms for theme, user session, sidebar state, and organisation context. SSR-compatible.',
            },
            {
                name: '@ottabase/utils',
                description:
                    'Timezone handling, string manipulation, file utilities, URL helpers, and git utilities. Check before reinventing.',
            },
            {
                name: '@ottabase/config',
                description:
                    'Application configuration, environment variable helpers, and storage key utilities. Typed, validated.',
            },
            {
                name: '@ottabase/docs',
                description:
                    'Markdown documentation viewer component. Renders .md files with syntax highlighting and TOC generation.',
            },
        ],
    },
];

export const FILTER_ORDER: { id: PkgCat | 'all'; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: 47 },
    { id: 'core', label: 'Core', count: 11 },
    { id: 'ui', label: 'UI', count: 12 },
    { id: 'content', label: 'Content', count: 5 },
    { id: 'business', label: 'Business', count: 5 },
    { id: 'brand', label: 'Brand', count: 5 },
    { id: 'utils', label: 'Utilities', count: 9 },
];
