/**
 * Single source of truth for the demo gallery: the sidebar, the index cards, the command
 * palette, the Cloudflare overview and the breadcrumbs all read this list.
 */
import { PACKAGES_ENABLED } from '@/ottabase/config';
import { IconMessageCircle } from '@tabler/icons-react';
import {
    Bell,
    Blocks,
    Bot,
    Calendar,
    Clock,
    Code,
    Crop,
    Database,
    FileStack,
    FileText,
    Highlighter,
    Languages,
    Layers,
    Layout,
    List,
    Mail,
    Navigation,
    Paintbrush,
    Palette,
    PanelTop,
    ScanSearch,
    Settings,
    ShieldCheck,
    SplitSquareHorizontal,
    Terminal,
    Timer,
    Type,
    Upload,
    FileOutput,
    Gauge,
    HardDrive,
    Image as ImageIcon,
    KeyRound,
    ListOrdered,
    Radio,
    ShieldAlert,
    Wind,
    Zap,
} from 'lucide-react';
import type { ElementType } from 'react';

export type DemoGroupId = 'design' | 'content' | 'data' | 'platform' | 'cloudflare';

export interface DemoGroup {
    id: DemoGroupId;
    label: string;
    description: string;
    /** A page that introduces the whole group, when there is one */
    overview?: string;
}

/** Gallery sections, in display order */
export const DEMO_GROUPS: DemoGroup[] = [
    {
        id: 'design',
        label: 'Design and layout',
        description: 'Theming, the layout engine, navigation and the UI kits.',
    },
    { id: 'content', label: 'Content', description: 'Writing, rendering, media, dates and languages.' },
    {
        id: 'data',
        label: 'Data and forms',
        description: 'The ORM, forms, selects, tables, state, the API client and config.',
    },
    {
        id: 'platform',
        label: 'Platform',
        description: 'Auth, email, notifications, analytics, logs, jobs and the CLI scripts.',
    },
    {
        id: 'cloudflare',
        label: 'Cloudflare',
        description:
            'The bindings the worker uses. The live pages need a platform admin; Images and Hyperdrive are setup guides.',
        overview: '/demo/cloudflare',
    },
];

export interface DemoItem {
    to: string;
    group: DemoGroupId;
    icon: ElementType;
    /** The one name the sidebar, the cards, the page heading and the breadcrumb all use */
    label: string;
    /** Card description, one or two sentences */
    description: string;
    /** Shown with a Featured badge on the card */
    featured?: boolean;
    /** Listed only while this package is enabled; its page would fail without it */
    requiresPackage?: keyof typeof PACKAGES_ENABLED;
}

const ALL_DEMOS: DemoItem[] = [
    {
        to: '/demo/theming',
        group: 'design',
        icon: Paintbrush,
        label: 'Theming',
        description: 'Theme presets and light or dark mode, with the brand kit the admin configured applied live.',
    },
    {
        to: '/demo/layout',
        group: 'design',
        icon: Layout,
        label: 'Layout engine',
        description:
            'Live-preview every layout preset per route, and test path-to-layout resolution with priority rules.',
    },
    {
        to: '/demo/medialibrary',
        group: 'content',
        icon: Blocks,
        label: 'Media library',
        description: 'Lightbox and media viewer components with image and video previews from @ottabase/medialibrary.',
    },
    {
        to: '/demo/ottaeditor',
        group: 'content',
        icon: Type,
        label: 'OttaEditor',
        description: 'Rich text editor with custom block tools and formatting.',
    },
    {
        to: '/demo/ui-cropper',
        group: 'content',
        icon: Crop,
        label: 'Image cropper',
        description:
            'Vanilla image cropper: crop, flip, rotate and zoom with a rectangle or circle viewfinder. PNG or JPEG out, no React, under 10 KB gzipped.',
    },
    {
        to: '/demo/split-pane',
        group: 'design',
        icon: SplitSquareHorizontal,
        label: 'Split pane',
        description: 'Split panes with nested layouts, snap points and percentage or pixel sizes.',
    },
    {
        to: '/demo/codeblock',
        group: 'content',
        icon: Highlighter,
        label: 'Code highlighting',
        description:
            'Syntax highlighting with highlight.js: bundled grammars for the web stack, copy to clipboard, line numbers and dark mode.',
    },
    {
        to: '/demo/state',
        group: 'data',
        icon: Settings,
        label: 'State',
        description: 'Global state with Jotai atoms: theme, user, sidebar, scale and zoom, wired to next-themes.',
    },
    {
        to: '/demo/ottaorm',
        group: 'data',
        icon: Database,
        label: 'OttaORM',
        description: 'Class-based models on D1, queried through the generic CRUD endpoints and TanStack Query hooks.',
    },
    {
        to: '/demo/comments',
        group: 'content',
        icon: IconMessageCircle,
        label: 'Comments',
        description: 'Threaded comments with reactions, moderation and polymorphic targets.',
        requiresPackage: 'comments',
    },
    {
        to: '/demo/ottaforms',
        group: 'data',
        icon: FileText,
        label: 'OttaForms',
        description:
            'Auto-generated CRUD forms from OttaORM model metadata. List, detail, create, and edit views with relationship field support.',
    },
    {
        to: '/demo/ottaselect',
        group: 'data',
        icon: List,
        label: 'OttaSelect',
        description: 'Searchable select component with async data loading and custom rendering.',
    },
    {
        to: '/demo/ui-datatable',
        group: 'data',
        icon: Layout,
        label: 'DataTable',
        description:
            'Data table on TanStack Table v8: sorting, filtering, pagination, column visibility, row selection and bulk actions.',
        featured: true,
    },
    {
        to: '/demo/logger',
        group: 'platform',
        icon: FileStack,
        label: 'Logger',
        description: 'Logger with levels, transports, formatters and child loggers.',
    },
    {
        to: '/demo/cloudflare/ai',
        group: 'cloudflare',
        icon: Bot,
        label: 'OttaAI',
        description:
            'Tenant-aware chat and embeddings through Cloudflare AI Gateway, with your key or the platform key and server-side task gates.',
        requiresPackage: 'ottaai',
    },
    {
        to: '/demo/cloudflare/pdf',
        group: 'cloudflare',
        icon: FileText,
        label: 'PDF rendering',
        description: 'Secure HTML-to-PDF export with static DOM capture, Browser Rendering, and safe metadata.',
    },
    {
        to: '/demo/cloudflare/file-upload',
        group: 'cloudflare',
        icon: Upload,
        label: 'File upload',
        description: 'Drag-and-drop uploader with progress, validation and R2 storage.',
    },
    {
        to: '/demo/timezone',
        group: 'content',
        icon: Clock,
        label: 'Timezone',
        description: "Store in UTC, display in the user's timezone: conversion, formatting and DST helpers.",
    },
    {
        to: '/demo/api',
        group: 'data',
        icon: Zap,
        label: 'API client',
        description: 'Type-safe fetch wrapper with error handling, auth injection and shorthand methods.',
    },
    {
        to: '/demo/renderer',
        group: 'content',
        icon: Code,
        label: 'OttaRenderer',
        description: 'Renders Editor.js and HTML content with custom block renderers and dark mode.',
    },
    {
        to: '/demo/email',
        group: 'platform',
        icon: Mail,
        label: 'Email',
        description: 'Every email the app sends, rendered from the catalogue with editable sample data.',
    },
    {
        to: '/demo/notifications',
        group: 'platform',
        icon: Bell,
        label: 'Notifications',
        description:
            'A mock inbox showing notification shapes, channels and priorities. The real inbox lives at /notifications.',
    },
    {
        to: '/demo/spotlight',
        group: 'design',
        icon: ScanSearch,
        label: 'Spotlight',
        description: 'Command palette with keyboard shortcuts, search handlers, and customizable result rendering.',
    },
    {
        to: '/demo/menus',
        group: 'design',
        icon: PanelTop,
        label: 'OttaMenu',
        description: 'Renderer playground for flyout, mega, navbar, dropdown, sidebar, and footer menu variants.',
    },
    {
        to: '/demo/analytics',
        group: 'platform',
        icon: Zap,
        label: 'Analytics',
        description:
            'Track events and query aggregated metrics through the @ottabase/analytics endpoints (platform admin).',
    },
    {
        to: '/demo/auth',
        group: 'platform',
        icon: ShieldCheck,
        label: 'Auth session',
        description: 'Inspect the session state, refresh and sign-out behaviour, and the storage keys.',
    },
    {
        to: '/demo/brand-engine',
        group: 'design',
        icon: Palette,
        label: 'Brand engine',
        description: 'The active brand config and route mapping resolution from @ottabase/brand-engine-react.',
    },
    {
        to: '/demo/ottadate',
        group: 'content',
        icon: Calendar,
        label: 'OttaDate',
        description:
            'Fuzzy dates people half remember (a zooming, hands-on playground), plus exact date, range and time pickers.',
        featured: true,
    },
    {
        to: '/demo/i18n',
        group: 'content',
        icon: Languages,
        label: 'i18n',
        description: 'Locale switching, translations, and pluralization with the i18n package.',
    },
    {
        to: '/demo/breadcrumbs',
        group: 'design',
        icon: Navigation,
        label: 'Breadcrumbs',
        description: 'Breadcrumb navigation from route metadata with readable labels, built on TanStack Router.',
    },
    {
        to: '/demo/shadcn',
        group: 'design',
        icon: Palette,
        label: 'shadcn/ui',
        description: 'The shadcn/ui primitives with Tailwind utilities and the shared theme providers.',
    },
    {
        to: '/demo/cron',
        group: 'platform',
        icon: Timer,
        label: 'Cron',
        description:
            'Laravel-style cron scheduler with expression parser, presets, and next-run calculation via @ottabase/cron.',
    },
    {
        to: '/demo/ui-tailwind',
        group: 'design',
        icon: Wind,
        label: 'Tailwind preset',
        description:
            'Shared Tailwind CSS preset mapping HSL CSS variables to utilities. Live token swatches and dark mode preview.',
    },
    {
        to: '/demo/ui-components',
        group: 'design',
        icon: Blocks,
        label: 'UI components',
        description:
            'Shared React components: ConfirmDialog, EmptyState, LoadingState, Chip, JsonEditor, Logo and more.',
    },
    {
        to: '/demo/ui-base',
        group: 'design',
        icon: Layers,
        label: 'UI base',
        description:
            'Framework-agnostic CSS foundation: reset, base styles, animations, and the ProviderUIBase provider.',
    },
    {
        to: '/demo/scripts',
        group: 'platform',
        icon: Terminal,
        label: 'Scripts',
        description: 'CLI tools for command discovery, Cloudflare setup, local env secrets, and cache/state cleanup.',
    },
    {
        to: '/demo/config',
        group: 'data',
        icon: Settings,
        label: 'Config',
        description:
            'Centralized app configuration: createAppConfig, defineOttabaseConfig, package gating, and env resolution.',
    },
    {
        to: '/demo/cloudflare/d1',
        group: 'cloudflare',
        icon: Database,
        label: 'D1',
        description: 'SQLite at the edge: typed queries, migrations and CRUD against the bound D1 database.',
    },
    {
        to: '/demo/cloudflare/kv',
        group: 'cloudflare',
        icon: KeyRound,
        label: 'KV',
        description: 'Key-value reads and writes with TTLs, the store behind sessions and caches.',
    },
    {
        to: '/demo/cloudflare/r2',
        group: 'cloudflare',
        icon: HardDrive,
        label: 'R2',
        description: 'Object storage for uploads and exports with no egress fees.',
    },
    {
        to: '/demo/cloudflare/images',
        group: 'cloudflare',
        icon: ImageIcon,
        label: 'Images',
        description: 'Upload, resize and deliver images through Cloudflare Images.',
    },
    {
        to: '/demo/cloudflare/hyperdrive',
        group: 'cloudflare',
        icon: Gauge,
        label: 'Hyperdrive',
        description: 'Connection pooling and query caching for an external Postgres or MySQL database.',
    },
    {
        to: '/demo/cloudflare/queues',
        group: 'cloudflare',
        icon: ListOrdered,
        label: 'Queues',
        description: 'Producers, consumers and retries on Cloudflare Queues for work that can wait.',
    },
    {
        to: '/demo/cloudflare/rate-limiting',
        group: 'cloudflare',
        icon: ShieldAlert,
        label: 'Rate limiting',
        description: 'Per-key request throttling with the Rate Limiting binding, and what a blocked call sees.',
    },
    {
        to: '/demo/cloudflare/realtime',
        group: 'cloudflare',
        icon: Radio,
        label: 'Realtime',
        description: 'WebSocket channels over Durable Objects with offline buffering.',
    },
    {
        to: '/demo/cloudflare/pdf/playground',
        group: 'cloudflare',
        icon: FileOutput,
        label: 'PDF playground',
        description: 'Render a document to PDF with Browser Rendering and tune the page, margins and headers.',
    },
];

/** The demos this install can show: a demo of a disabled package is left out everywhere */
export const DEMO_ITEMS: DemoItem[] = ALL_DEMOS.filter(
    (item) => !item.requiresPackage || PACKAGES_ENABLED[item.requiresPackage],
);

/** Items that match a query in their label or description; everything when the query is empty. */
export function searchDemos(query: string, items: DemoItem[] = DEMO_ITEMS): DemoItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(q));
}

/** The gallery sections in order, each with its items; a section with nothing in it is left out. */
export function groupDemos(items: DemoItem[] = DEMO_ITEMS): { group: DemoGroup; items: DemoItem[] }[] {
    return DEMO_GROUPS.map((group) => ({ group, items: items.filter((item) => item.group === group.id) })).filter(
        (section) => section.items.length > 0,
    );
}
