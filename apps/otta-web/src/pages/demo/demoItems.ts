/**
 * Single source of truth for demo gallery items.
 * Used by both DemoLayout (sidemenu) and DemoIndexPage (cards).
 */
import { IconMessageCircle } from '@tabler/icons-react';
import {
    Bell,
    Blocks,
    Bot,
    Calendar,
    Clock,
    Cloud,
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
    { id: 'data', label: 'Data and forms', description: 'The ORM, forms, selects, tables, state and config.' },
    { id: 'platform', label: 'Platform', description: 'Auth, email, notifications, analytics, logs and jobs.' },
    {
        id: 'cloudflare',
        label: 'Cloudflare',
        description: 'Every binding the worker can use, each with a live page.',
        overview: '/demo/cloudflare',
    },
];

export interface DemoItem {
    to: string;
    group: DemoGroupId;
    icon: ElementType;
    /** Short label for sidemenu */
    label: string;
    /** Card title (can differ from label) */
    title: string;
    /** Card description */
    description: string;
    /** Card button variant - featured */
    buttonVariant?: 'default' | 'outline';
}

export const DEMO_ITEMS: DemoItem[] = [
    {
        to: '/demo/theming',
        group: 'design',
        icon: Paintbrush,
        label: 'Brand Engine (Theming)',
        title: 'Theming Configurator',
        description: 'Theme presets and light/dark mode. Admin-configured Brand Engine themes with live preview.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/layout',
        group: 'design',
        icon: Layout,
        label: 'Layout Engine (Dynamic)',
        title: 'Dynamic Layout Engine',
        description:
            'Live-preview every layout preset per route, and test path-to-layout resolution with priority rules.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/medialibrary',
        group: 'content',
        icon: Blocks,
        label: 'Media Library',
        title: 'Media Library',
        description: 'Media viewer/lightbox components with image and video previews from @ottabase/medialibrary.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/ottaeditor',
        group: 'content',
        icon: Type,
        label: 'OttaEditor',
        title: 'OttaEditor',
        description: 'Rich text editor with custom plugins and formatting capabilities',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/ui-cropper',
        group: 'content',
        icon: Crop,
        label: 'Image Cropper',
        title: 'Image Cropper',
        description:
            'Vanilla image cropper: crop, flip, rotate. Square/rect/circle viewfinder. PNG/JPEG. Zero React. ~2–3 KB gzipped.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/split-pane',
        group: 'design',
        icon: SplitSquareHorizontal,
        label: 'Split Pane',
        title: 'Split Pane',
        description:
            'Minimal, clean split-pane component with support for nested layouts, snap points, and percentage-based sizing',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/codeblock',
        group: 'content',
        icon: Highlighter,
        label: 'Code Highlighting',
        title: 'Code Highlighting',
        description:
            'GitHub-style syntax highlighting with highlight.js. Supports 190+ languages, copy to clipboard, line numbers, and light/dark themes.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/state',
        group: 'data',
        icon: Settings,
        label: 'Global State Management',
        title: 'Global State Management',
        description:
            'Global state with Jotai atoms: theme, user, sidebar, scale, zoom. Integrates with next-themes for light/dark mode.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/ottaorm',
        group: 'data',
        icon: Database,
        label: 'OttaORM',
        title: 'OttaORM',
        description: 'Class-based Drizzle ORM demo running on D1 via Worker endpoints',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/comments',
        group: 'content',
        icon: IconMessageCircle,
        label: 'Comments',
        title: 'Comments',
        description: 'Threaded comments with reactions, moderation, and polymorphic targeting',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/ottaforms',
        group: 'data',
        icon: FileText,
        label: 'OttaForms',
        title: 'OttaForms',
        description:
            'Auto-generated CRUD forms from OttaORM model metadata. List, detail, create, and edit views with relationship field support.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/ottaselect',
        group: 'data',
        icon: List,
        label: 'OttaSelect',
        title: 'OttaSelect',
        description: 'Searchable select component with async data loading and custom rendering.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/ui-datatable',
        group: 'data',
        icon: Layout,
        label: 'DataTable',
        title: 'DataTable',
        description:
            'Advanced data table on TanStack Table v8: server-side sort/filter/pagination, column visibility, row selection, bulk actions.',
        buttonVariant: 'default',
    },
    {
        to: '/demo/logger',
        group: 'platform',
        icon: FileStack,
        label: 'Logger',
        title: 'Logger',
        description: 'Extensible logger with levels, transports, formatters, child loggers, and config-based setup.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cloudflare/ai',
        group: 'cloudflare',
        icon: Bot,
        label: 'OttaAI Playground',
        title: 'OttaAI Playground',
        description:
            'Tenant-aware chat and embeddings through Cloudflare AI Gateway — tenant key or platform fallback, with server-side task gates',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cloudflare/pdf',
        group: 'cloudflare',
        icon: FileText,
        label: 'PDF Rendering',
        title: 'Cloudflare PDF Rendering',
        description: 'Secure HTML-to-PDF export with static DOM capture, Browser Rendering, and safe metadata.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cloudflare/file-upload',
        group: 'cloudflare',
        icon: Upload,
        label: 'File Upload',
        title: 'File Upload Package',
        description:
            'Drag-and-drop file uploader with progress tracking, validation, and Cloudflare R2/Images integration',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/timezone',
        group: 'content',
        icon: Clock,
        label: 'Timezone Utils',
        title: 'Timezone Utilities',
        description:
            "Production-ready timezone standardization: always store in UTC, display in user's timezone. Lightweight and type-safe.",
        buttonVariant: 'outline',
    },
    {
        to: '/demo/api',
        group: 'data',
        icon: Zap,
        label: 'API Client',
        title: 'API Client',
        description: 'Type-safe fetch wrapper with error handling, auth injection, and shorthand method syntax',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/renderer',
        group: 'content',
        icon: Code,
        label: 'Content Renderer',
        title: 'OttaRenderer',
        description: 'Content renderer for EditorJS and HTML with custom block renderers and dark mode support',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/email',
        group: 'platform',
        icon: Mail,
        label: 'Email Templates',
        title: 'Email Templates',
        description: 'Preview Handlebars email templates and replacement data with the @ottabase/email package',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/notifications',
        group: 'platform',
        icon: Bell,
        label: 'Notifications',
        title: 'Notifications',
        description:
            'Multi-channel notification system with email, WebSocket, and system alerts via @ottabase/notifications',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/spotlight',
        group: 'design',
        icon: ScanSearch,
        label: 'Spotlight',
        title: 'Spotlight',
        description: 'Command palette with keyboard shortcuts, search handlers, and customizable result rendering.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/menus',
        group: 'design',
        icon: PanelTop,
        label: 'Menu Renderer',
        title: 'OttaMenu',
        description: 'Renderer playground for flyout, mega, navbar, dropdown, sidebar, and footer menu variants.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/analytics',
        group: 'platform',
        icon: Zap,
        label: 'Analytics',
        title: 'Analytics',
        description: 'Track events and query aggregated metrics through @ottabase/analytics endpoints.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/auth',
        group: 'platform',
        icon: ShieldCheck,
        label: 'Auth Session',
        title: 'Auth Session',
        description: 'Inspect auth session state, refresh/logout behavior, and localStorage helper keys.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/brand-engine',
        group: 'design',
        icon: Palette,
        label: 'Brand Engine',
        title: 'Brand Engine',
        description: 'View active brand config and test route mapping resolution from @ottabase/brand-engine-react.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/ottadate',
        group: 'content',
        icon: Calendar,
        label: 'OttaDate',
        title: 'OttaDate',
        description:
            'Fuzzy dates people half remember (a zooming, hands-on playground), plus exact date, range and time pickers.',
        buttonVariant: 'default',
    },
    {
        to: '/demo/i18n',
        group: 'content',
        icon: Languages,
        label: 'Internationalization (i18n)',
        title: 'Internationalization',
        description: 'Locale switching, translations, and pluralization with the i18n package.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/breadcrumbs',
        group: 'design',
        icon: Navigation,
        label: 'Breadcrumbs',
        title: 'Smart Breadcrumbs',
        description:
            'Automatic breadcrumb navigation with intelligent route metadata and human-readable labels. Fully TanStack Router integrated.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/mantine',
        group: 'design',
        icon: Layout,
        label: 'Mantine UI',
        title: 'Mantine Demo',
        description: 'Full-featured demo showcasing Mantine components, theme switching, state management, and more',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/shadcn',
        group: 'design',
        icon: Palette,
        label: 'shadcn/ui',
        title: 'shadcn/ui Demo',
        description: 'Explore shadcn/ui primitives with Tailwind utilities and shared theme providers',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cron',
        group: 'platform',
        icon: Timer,
        label: 'Cron Scheduler',
        title: 'Cron Scheduler',
        description:
            'Laravel-style cron scheduler with expression parser, presets, and next-run calculation via @ottabase/cron.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/ui-tailwind',
        group: 'design',
        icon: Wind,
        label: 'Tailwind (Preset)',
        title: 'Tailwind (Preset)',
        description:
            'Shared Tailwind CSS preset mapping HSL CSS variables to utilities. Live token swatches and dark mode preview.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/ui-components',
        group: 'design',
        icon: Blocks,
        label: 'UI Components',
        title: 'UI Components',
        description: 'Shared React components: ConfirmDialog, MessageBox, Logo, DarkModeToggle, and BlogPagination.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/ui-base',
        group: 'design',
        icon: Layers,
        label: 'UI Base',
        title: 'UI Base',
        description:
            'Framework-agnostic CSS foundation: reset, base styles, animations, and the ProviderUIBase provider.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/scripts',
        group: 'platform',
        icon: Terminal,
        label: 'Scripts (CLI)',
        title: 'Scripts (CLI)',
        description: 'CLI tools for command discovery, Cloudflare setup, local env secrets, and cache/state cleanup.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/config',
        group: 'data',
        icon: Settings,
        label: 'Config',
        title: 'Config',
        description:
            'Centralized app configuration: createAppConfig, defineOttabaseConfig, package gating, and env resolution.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cloudflare/d1',
        group: 'cloudflare',
        icon: Database,
        label: 'D1 Database',
        title: 'D1 Database',
        description: 'SQLite at the edge: typed queries, migrations and CRUD against the bound D1 database.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cloudflare/kv',
        group: 'cloudflare',
        icon: KeyRound,
        label: 'KV Storage',
        title: 'KV Storage',
        description: 'Key-value reads and writes with TTLs and metadata, the store behind sessions and caches.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cloudflare/r2',
        group: 'cloudflare',
        icon: HardDrive,
        label: 'R2 Storage',
        title: 'R2 Storage',
        description: 'Object storage for uploads and exports, with signed access and no egress fees.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cloudflare/images',
        group: 'cloudflare',
        icon: ImageIcon,
        label: 'Images',
        title: 'Cloudflare Images',
        description: 'Upload, resize and deliver images through Cloudflare Images.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cloudflare/hyperdrive',
        group: 'cloudflare',
        icon: Gauge,
        label: 'Hyperdrive',
        title: 'Hyperdrive',
        description: 'Connection pooling and query caching for an external Postgres or MySQL database.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cloudflare/queues',
        group: 'cloudflare',
        icon: ListOrdered,
        label: 'Queues',
        title: 'Queues',
        description: 'Producers, consumers and retries on Cloudflare Queues for work that can wait.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cloudflare/rate-limiting',
        group: 'cloudflare',
        icon: ShieldAlert,
        label: 'Rate Limiting',
        title: 'Rate Limiting',
        description: 'Per key request throttling with the Rate Limiting binding, and what a blocked call sees.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cloudflare/realtime',
        group: 'cloudflare',
        icon: Radio,
        label: 'Realtime',
        title: 'Realtime Pub/Sub',
        description: 'WebSocket channels over Durable Objects with offline buffering and presence.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cloudflare/pdf/playground',
        group: 'cloudflare',
        icon: FileOutput,
        label: 'PDF Playground',
        title: 'PDF Playground',
        description: 'Render a document to PDF with Browser Rendering and tune the page, margins and headers.',
        buttonVariant: 'outline',
    },
];

/** Items that match a query in their label, title or description; everything when the query is empty. */
export function searchDemos(query: string, items: DemoItem[] = DEMO_ITEMS): DemoItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => `${item.label} ${item.title} ${item.description}`.toLowerCase().includes(q));
}

/** The gallery sections in order, each with its items; a section with nothing in it is left out. */
export function groupDemos(items: DemoItem[] = DEMO_ITEMS): { group: DemoGroup; items: DemoItem[] }[] {
    return DEMO_GROUPS.map((group) => ({ group, items: items.filter((item) => item.group === group.id) })).filter(
        (section) => section.items.length > 0,
    );
}
