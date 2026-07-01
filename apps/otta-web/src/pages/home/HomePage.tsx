import { APP_META } from '@/ottabase/config';
import { MediaLightboxProvider } from '@ottabase/medialibrary';
import { Blocks, customRenderers, defaultEJSRConfigs } from '@ottabase/ottarenderer';
import '@ottabase/ottarenderer/styles';
import { useMemo } from 'react';

/** EditorJS blocks for the home page. */
function createHomeLandingEditorData(appName: string) {
    return {
        time: Date.now(),
        version: '2.28.0',
        blocks: [
            // ── Hero title + lead ────────────────────────────────────────────
            {
                id: 'home-title',
                type: 'header',
                data: { text: appName, level: 1 },
            },
            {
                id: 'home-lead',
                type: 'paragraph',
                data: {
                    text: 'Production-grade Apps/SaaS/Sites on <strong>Cloudflare Workers</strong>. Multi-tenant isolation, fat models, runtime theming, and 45+ batteries-included packages — all wired together and ready to ship. <strong>Fast. For the Solo Founder.</strong>',
                },
            },
            // Hero CTAs
            {
                id: 'home-hero-ctas',
                type: 'layout',
                data: {
                    preset: '1-1',
                    columns: [
                        {
                            content: {
                                blocks: [
                                    {
                                        id: 'cta-start',
                                        type: 'cta',
                                        data: {
                                            text: 'Get started',
                                            url: '/docs',
                                            style: 'primary',
                                            alignment: 'right',
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            content: {
                                blocks: [
                                    {
                                        id: 'cta-demos',
                                        type: 'cta',
                                        data: {
                                            text: 'Explore demos',
                                            url: '/demo',
                                            style: 'outline',
                                            alignment: 'left',
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
            },

            // ── Three pillars ────────────────────────────────────────────────
            {
                id: 'pillars',
                type: 'layout',
                data: {
                    preset: '1-1-1',
                    columns: [
                        {
                            content: {
                                blocks: [
                                    { id: 'p1h', type: 'header', data: { text: 'Edge-native', level: 3 } },
                                    {
                                        id: 'p1p',
                                        type: 'paragraph',
                                        data: {
                                            text: 'Runs on Cloudflare Workers globally. No cold starts, no servers — your backend <em>is</em> the CDN.',
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            content: {
                                blocks: [
                                    { id: 'p2h', type: 'header', data: { text: 'Multi-tenant', level: 3 } },
                                    {
                                        id: 'p2p',
                                        type: 'paragraph',
                                        data: {
                                            text: 'RLS enforced at the ORM layer. Organizations never leak data. Add tenants without touching a query.',
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            content: {
                                blocks: [
                                    { id: 'p3h', type: 'header', data: { text: 'Fat models', level: 3 } },
                                    {
                                        id: 'p3p',
                                        type: 'paragraph',
                                        data: {
                                            text: 'Business logic lives in models, not controllers. One TypeScript class owns schema, casts, RLS, and hooks.',
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
            },

            // ── Checklist ────────────────────────────────────────────────────
            { id: 'batteries-h', type: 'header', data: { text: 'Batteries included', level: 2 } },
            {
                id: 'checklist',
                type: 'checklist',
                data: {
                    items: [
                        { text: '<strong>OttaORM</strong>: fat models, RLS, hooks', checked: true },
                        { text: '<strong>Brand Engine</strong>: dynamic runtime theming (per-route!)', checked: true },
                        { text: '<strong>Ottabase Auth</strong>: OAuth + signed sessions', checked: true },
                        { text: '<strong>RBAC</strong>: per-org roles + guards', checked: true },
                        { text: '<strong>Ottablog</strong>: CMS, WYSIWYG, Tags, SEO', checked: true },
                        { text: '<strong>OttaRenderer</strong>: blocks + dark mode support', checked: true },
                        { text: '<strong>Media Library</strong>: R2 Uploads + Media Gallery lightbox', checked: true },
                        { text: '<strong>Queue</strong>: jobs, chaining, retry', checked: true },
                        { text: '<strong>Realtime</strong>: WebSocket pub/sub', checked: true },
                        { text: '<strong>Shortlinks</strong>: URLs + Cloudflare analytics', checked: true },
                        { text: '<strong>Auto-migrations</strong>: A single click does it all', checked: true },
                        { text: '<strong>Turborepo</strong>: pnpm workspaces', checked: true },
                    ],
                },
            },

            // ── Code block ─────────────────────────────────────────────────
            { id: 'code-h', type: 'header', data: { text: 'Fat models in practice', level: 2 } },
            {
                id: 'code-block',
                type: 'code',
                data: {
                    language: 'typescript',
                    showLineNumbers: true,
                    code: `// One class. Schema + RLS + hooks. Pseudo-code, see docs for exact API.
export class Post extends BaseModel {
    static entity = 'posts';
    static table  = postsTable;
    static rls = { tenant: { field: 'organizationId' } };
    static casts = { publishedAt: 'date' as const };

    async publish() {
        this.set('status', 'published');
        this.set('publishedAt', new Date().toISOString());
        return this.save();
    }
}

// TanStack Query hooks — zero boilerplate
export const { useList, useCreate, useUpdate, useDelete } =
    createModelHooks<PostType>({ entityName: 'posts' });`,
                },
            },

            // ── Getting started ──────────────────────────────────────────────
            { id: 'steps-h', type: 'header', data: { text: 'From zero to deployed', level: 2 } },
            {
                id: 'steps',
                type: 'steps',
                data: {
                    items: [
                        {
                            title: 'Clone & install',
                            content:
                                '<code class="inline-code">git clone</code> → <code class="inline-code">pnpm install</code> → <code class="inline-code">pnpm build:pkg</code> → <code class="inline-code">pnpm dev</code>',
                        },
                        {
                            title: 'Configure',
                            content:
                                '<code class="inline-code">.env.example → .env.local</code> with D1 binding, R2 bucket, OAuth.',
                        },
                        {
                            title: 'Bootstrap & ship',
                            content:
                                'GUI Bootstrapping, create owner, configure Cloudflare API, <code class="inline-code">wrangler deploy</code>. Github CI/CD included.',
                        },
                    ],
                },
            },

            // ── FAQ ──────────────────────────────────────────────────────────
            { id: 'faq-h', type: 'header', data: { text: 'Common questions', level: 2 } },
            {
                id: 'faq',
                type: 'faq',
                data: {
                    style: 'accordion',
                    items: [
                        {
                            question: 'Is multi-tenancy production-ready?',
                            answer: 'Yes. RLS rules are declared on the model and enforced on every query automatically.',
                        },
                        {
                            question: 'How does per-tenant theming work?',
                            answer: 'Brand Engine stores tokens in the DB and injects CSS custom vars at request time. Cached on edge via KV.',
                        },
                        {
                            question: 'What db is supported?',
                            answer: 'Cloudflare D1 (SQLite at the edge) via Drizzle ORM. Migrations via a single API call (or via admin UI).',
                        },
                        {
                            question: 'Do I need Docker?',
                            answer: 'No. Everything runs on Cloudflare — Workers, D1, Queues, Durable Objects,R2, KV. Wrangler emulates everything locally, no Docker required for dev either.',
                        },
                    ],
                },
            },

            // ── Final CTAs ───────────────────────────────────────────────────
            {
                id: 'final-ctas',
                type: 'layout',
                data: {
                    preset: '1-1',
                    columns: [
                        {
                            content: {
                                blocks: [
                                    {
                                        id: 'cta-demos-2',
                                        type: 'cta',
                                        data: {
                                            text: 'Explore demos',
                                            url: '/demo',
                                            style: 'primary',
                                            alignment: 'right',
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            content: {
                                blocks: [
                                    {
                                        id: 'cta-docs-2',
                                        type: 'cta',
                                        data: {
                                            text: 'Read the docs',
                                            url: '/docs/',
                                            style: 'outline',
                                            alignment: 'left',
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        ],
    };
}

export function HomePage() {
    const editorData = useMemo(() => createHomeLandingEditorData('Ottabase'), []);

    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:px-10 md:py-12 lg:px-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Logo: Using JSX, and not advancedImage (which ignores width/height) */}
            <div className="mb-12 flex justify-center">
                <img
                    src="https://ottabase.com/favicon.svg"
                    alt={APP_META.appName}
                    width={128}
                    height={128}
                    className="rounded-full border border-border bg-background p-2"
                />
            </div>

            <div className="prose dark:prose-invert max-w-none text-left">
                <MediaLightboxProvider variant="immersive">
                    <Blocks data={editorData} config={defaultEJSRConfigs} renderers={customRenderers} />
                </MediaLightboxProvider>
            </div>
        </div>
    );
}
