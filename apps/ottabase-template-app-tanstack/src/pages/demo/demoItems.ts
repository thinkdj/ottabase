/**
 * Single source of truth for demo gallery items.
 * Used by both DemoLayout (sidemenu) and DemoIndexPage (cards).
 */
import type { ElementType } from 'react';
import {
    Bell,
    Clock,
    Cloud,
    Code,
    Crop,
    Database,
    FileStack,
    FileText,
    Highlighter,
    Languages,
    Layout,
    List,
    Mail,
    Navigation,
    Paintbrush,
    Palette,
    Settings,
    Type,
    Upload,
    Zap,
} from 'lucide-react';

export interface DemoItem {
    to: string;
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
        to: '/demo/state',
        icon: Settings,
        label: 'State Management',
        title: 'State Management',
        description:
            'Global state with Jotai atoms: theme, user, sidebar, scale, zoom. Integrates with next-themes for light/dark mode.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/logger',
        icon: FileStack,
        label: 'Logger',
        title: 'Logger',
        description: 'Extensible logger with levels, transports, formatters, child loggers, and config-based setup.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/i18n',
        icon: Languages,
        label: 'Internationalization (i18n)',
        title: 'Internationalization',
        description: 'Locale switching, translations, and pluralization with the i18n package.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/breadcrumbs',
        icon: Navigation,
        label: 'Breadcrumbs',
        title: 'Smart Breadcrumbs',
        description:
            'Automatic breadcrumb navigation with intelligent route metadata and human-readable labels. Fully TanStack Router integrated.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/mantine',
        icon: Layout,
        label: 'Mantine UI',
        title: 'Mantine Demo',
        description: 'Full-featured demo showcasing Mantine components, theme switching, state management, and more',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/shadcn',
        icon: Palette,
        label: 'shadcn/ui',
        title: 'shadcn/ui Demo',
        description: 'Explore shadcn/ui primitives with Tailwind utilities and shared theme providers',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/theming',
        icon: Paintbrush,
        label: 'Theming',
        title: 'Theming Configurator',
        description: 'Theme presets and light/dark mode. Admin-configured Brand Engine themes with live preview.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/ottaeditor',
        icon: Type,
        label: 'OttaEditor',
        title: 'OttaEditor',
        description: 'Rich text editor with custom plugins and formatting capabilities',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cropper',
        icon: Crop,
        label: 'Cropper',
        title: 'Image Cropper',
        description:
            'Vanilla image cropper: crop, flip, rotate. Square/rect/circle viewfinder. PNG/JPEG. Zero React. ~2–3 KB gzipped.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/codeblock',
        icon: Highlighter,
        label: 'Code Highlighting',
        title: 'Code Highlighting',
        description:
            'GitHub-style syntax highlighting with highlight.js. Supports 190+ languages, copy to clipboard, line numbers, and light/dark themes.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/ottaorm',
        icon: Database,
        label: 'OttaORM',
        title: 'OttaORM',
        description: 'Class-based Drizzle ORM demo running on D1 via Worker endpoints',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/ottaforms',
        icon: FileText,
        label: 'OttaForms',
        title: 'OttaForms',
        description:
            'Auto-generated CRUD forms from OttaORM model metadata. List, detail, create, and edit views with relationship field support.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/ottaselect',
        icon: List,
        label: 'OttaSelect',
        title: 'OttaSelect',
        description: 'Searchable select component with async data loading and custom rendering.',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cloudflare',
        icon: Cloud,
        label: 'Cloudflare Services',
        title: 'Cloudflare Services',
        description:
            'Type-safe wrappers for Cloudflare infrastructure: KV, D1, R2, Queues, Images, PubSub, and Rate Limiting',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/cloudflare/file-upload',
        icon: Upload,
        label: 'File Upload',
        title: 'File Upload Package',
        description:
            'Drag-and-drop file uploader with progress tracking, validation, and Cloudflare R2/Images integration',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/timezone',
        icon: Clock,
        label: 'Timezone Utils',
        title: 'Timezone Utilities',
        description:
            "Production-ready timezone standardization: always store in UTC, display in user's timezone. Lightweight and type-safe.",
        buttonVariant: 'outline',
    },
    {
        to: '/demo/api',
        icon: Zap,
        label: 'API Client',
        title: 'API Client',
        description: 'Type-safe fetch wrapper with error handling, auth injection, and shorthand method syntax',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/renderer',
        icon: Code,
        label: 'Content Renderer',
        title: 'OttaRenderer',
        description: 'Content renderer for EditorJS and HTML with custom block renderers and dark mode support',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/email',
        icon: Mail,
        label: 'Email Templates',
        title: 'Email Templates',
        description: 'Preview Handlebars email templates and replacement data with the @ottabase/email package',
        buttonVariant: 'outline',
    },
    {
        to: '/demo/notifications',
        icon: Bell,
        label: 'Notifications',
        title: 'Notifications',
        description:
            'Multi-channel notification system with email, WebSocket, and system alerts via @ottabase/notifications',
        buttonVariant: 'outline',
    },
];
