// @ts-nocheck - EditorJS plugins have inconsistent type definitions
import CheckList from '@editorjs/checklist';
import CodeTool from '@editorjs/code';
import Delimiter from '@editorjs/delimiter';
import Embed from '@editorjs/embed';
import Header from '@editorjs/header';
import InlineCode from '@editorjs/inline-code';
import LinkTool from '@editorjs/link';
import Marker from '@editorjs/marker';
import NestedList from '@editorjs/nested-list';
import Paragraph from '@editorjs/paragraph';
import Quote from '@editorjs/quote';
import Raw from '@editorjs/raw';
import Table from '@editorjs/table';
import Underline from '@editorjs/underline';
import Warning from '@editorjs/warning';
import CTATool from './tools/CTATool/CTATool';
import ReviewTool from './tools/ReviewTool/ReviewTool';
import SpoilerTool from './tools/SpoilerTool/SpoilerTool';
import type { OttaEditorPlugin } from './types';

/**
 * Default plugin names as typed constants
 */
export const DEFAULT_PLUGIN_NAMES = {
    HEADER: 'header',
    PARAGRAPH: 'paragraph',
    LIST: 'list',
    CHECKLIST: 'checklist',
    CODE: 'code',
    QUOTE: 'quote',
    TABLE: 'table',
    WARNING: 'warning',
    DELIMITER: 'delimiter',
    LINK_TOOL: 'linkTool',
    EMBED: 'embed',
    RAW: 'raw',
    MARKER: 'Marker',
    UNDERLINE: 'underline',
    INLINE_CODE: 'inlineCode',
    SPOILER: 'spoiler',
    CTA: 'cta',
    REVIEW: 'review',
} as const;

/**
 * Type representing all available default plugin names
 */
export type DefaultPluginName = (typeof DEFAULT_PLUGIN_NAMES)[keyof typeof DEFAULT_PLUGIN_NAMES];

/**
 * Default EditorJS plugins configuration
 * These plugins are pre-installed with ottaeditor and ready to use
 */
export const defaultPlugins: OttaEditorPlugin[] = [
    {
        name: DEFAULT_PLUGIN_NAMES.HEADER,
        tool: Header as any,
        config: {
            placeholder: 'Enter a header',
            levels: [1, 2, 3, 4, 5, 6],
            defaultLevel: 2,
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.PARAGRAPH,
        tool: Paragraph as any,
        config: {
            placeholder: 'Start writing your text...',
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.LIST,
        tool: NestedList as any,
        config: {
            defaultStyle: 'unordered',
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.CHECKLIST,
        tool: CheckList as any,
        config: {},
    },
    {
        name: DEFAULT_PLUGIN_NAMES.CODE,
        tool: CodeTool as any,
        config: {
            placeholder: 'Enter your code here...',
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.QUOTE,
        tool: Quote as any,
        config: {
            quotePlaceholder: 'Enter a quote',
            captionPlaceholder: "Quote's author",
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.TABLE,
        tool: Table as any,
        config: {
            rows: 2,
            cols: 3,
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.WARNING,
        tool: Warning as any,
        config: {
            titlePlaceholder: 'Title',
            messagePlaceholder: 'Message',
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.DELIMITER,
        tool: Delimiter as any,
        config: {},
    },
    {
        name: DEFAULT_PLUGIN_NAMES.LINK_TOOL,
        tool: LinkTool as any,
        config: {
            endpoint: '/api/link-preview', // Apps can override this
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.EMBED,
        tool: Embed as any,
        config: {},
    },
    {
        name: DEFAULT_PLUGIN_NAMES.RAW,
        tool: Raw as any,
        config: {
            placeholder: 'Enter raw HTML...',
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.MARKER,
        tool: Marker as any,
        config: {},
    },
    {
        name: DEFAULT_PLUGIN_NAMES.UNDERLINE,
        tool: Underline as any,
        config: {},
    },
    {
        name: DEFAULT_PLUGIN_NAMES.INLINE_CODE,
        tool: InlineCode as any,
        config: {},
    },
    {
        name: DEFAULT_PLUGIN_NAMES.SPOILER,
        tool: SpoilerTool as any,
        config: {
            placeholder: 'Enter spoiler text...',
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.CTA,
        tool: CTATool as any,
        config: {
            placeholder: 'Enter button text...',
            defaultStyle: 'primary',
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.REVIEW,
        tool: ReviewTool as any,
        config: {} as any,
    },
];

/**
 * Map of default plugin names to their plugin configurations
 * Useful for selective plugin loading
 */
export const defaultPluginsMap = new Map<string, OttaEditorPlugin>(
    defaultPlugins.map((plugin) => [plugin.name, plugin]),
);

/**
 * Get specific default plugins by their names
 * @param names - Array of plugin names to retrieve, or 'all' to get all plugins
 * @returns Array of requested plugin configurations
 */
export function getDefaultPlugins(names: DefaultPluginName[] | 'all'): OttaEditorPlugin[] {
    if (names === 'all') {
        return [...defaultPlugins];
    }

    return names
        .map((name) => defaultPluginsMap.get(name))
        .filter((plugin): plugin is OttaEditorPlugin => plugin !== undefined);
}

/**
 * Re-export all default plugins for custom usage
 */
export {
    CheckList,
    CodeTool,
    CTATool,
    Delimiter,
    Embed,
    Header,
    InlineCode,
    LinkTool,
    Marker,
    NestedList,
    Paragraph,
    Quote,
    Raw,
    ReviewTool,
    SpoilerTool,
    Table,
    Underline,
    Warning,
};
