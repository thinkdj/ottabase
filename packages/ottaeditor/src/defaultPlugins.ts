// @ts-nocheck - EditorJS plugins have inconsistent type definitions
import CheckList from '@editorjs/checklist';
import Delimiter from '@editorjs/delimiter';
import Embed from '@editorjs/embed';
import Header from '@editorjs/header';
import InlineCode from '@editorjs/inline-code';
import LinkTool from '@editorjs/link';
import Marker from '@editorjs/marker';
import NestedList from '@editorjs/nested-list';
import Paragraph from '@editorjs/paragraph';
import Quote from '@editorjs/quote';
import Table from '@editorjs/table';
import Underline from '@editorjs/underline';
import Warning from '@editorjs/warning';
import AdvancedImageTool from './tools/AdvancedImageTool/AdvancedImageTool';
import AnnotationTool from './tools/AnnotationTool/AnnotationTool';
import BeforeAfterTool from './tools/BeforeAfterTool/BeforeAfterTool';
import CodeTool from './tools/CodeTool/CodeTool';
import CTATool from './tools/CTATool/CTATool';
import DisclosureTool from './tools/DisclosureTool/DisclosureTool';
import FaqTool from './tools/FaqTool/FaqTool';
import ImageHotspotsTool from './tools/ImageHotspotsTool/ImageHotspotsTool';
import LayoutTool from './tools/LayoutTool/LayoutTool';
import MapTool from './tools/MapTool/MapTool';
import MediaEmbedTool from './tools/MediaEmbedTool/MediaEmbedTool';
import MediaGalleryTool from './tools/MediaGalleryTool/MediaGalleryTool';
import RawHtmlTool from './tools/RawHtmlTool/RawHtmlTool';
import ReviewTool from './tools/ReviewTool/ReviewTool';
import SpoilerTool from './tools/SpoilerTool/SpoilerTool';
import StepsTool from './tools/StepsTool/StepsTool';
import ReferencesTool from './tools/ReferencesTool/ReferencesTool';
import TestimonialTool from './tools/TestimonialTool/TestimonialTool';
import type { OttaEditorPlugin } from './types';

const Raw = RawHtmlTool;

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
    ANNOTATION: 'annotation',
    BEFORE_AFTER: 'beforeAfter',
    SPOILER: 'spoiler',
    CTA: 'cta',
    REVIEW: 'review',
    MAP: 'map',
    LAYOUT: 'layout',
    DISCLOSURE: 'disclosure',
    STEPS: 'steps',
    MEDIA_EMBED: 'mediaEmbed',
    MEDIA_GALLERY: 'mediaGallery',
    FAQ: 'faq',
    IMAGE_HOTSPOTS: 'imageHotspots',
    TESTIMONIAL: 'testimonial',
    REFERENCES: 'references',
} as const;

/**
 * Type representing all available default plugin names
 */
export type DefaultPluginName = (typeof DEFAULT_PLUGIN_NAMES)[keyof typeof DEFAULT_PLUGIN_NAMES];

/**
 * Build the tools config for nested Layout editors.
 * Includes all default block tools except Layout itself (prevents infinite nesting).
 */
function buildLayoutNestedTools(): Record<string, any> {
    return {
        paragraph: { class: Paragraph, config: { placeholder: 'Start writing…' } },
        header: { class: Header, config: { levels: [1, 2, 3, 4, 5, 6], defaultLevel: 2 } },
        image: { class: AdvancedImageTool },
        delimiter: { class: Delimiter },
        code: { class: CodeTool, config: { placeholder: 'Enter your code here…' } },
        list: { class: NestedList, config: { defaultStyle: 'unordered' } },
        checklist: { class: CheckList },
        table: { class: Table, config: { rows: 2, cols: 3 } },
        mediaGallery: { class: MediaGalleryTool },
    };
}

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
        tool: RawHtmlTool as any,
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
        name: DEFAULT_PLUGIN_NAMES.ANNOTATION,
        tool: AnnotationTool as any,
        config: {},
    },
    {
        name: DEFAULT_PLUGIN_NAMES.BEFORE_AFTER,
        tool: BeforeAfterTool as any,
        config: {} as any,
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
    {
        name: DEFAULT_PLUGIN_NAMES.MAP,
        tool: MapTool as any,
        config: {
            defaultProvider: 'openstreetmap',
            defaultHeight: 400,
            defaultTheme: 'default',
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.LAYOUT,
        tool: LayoutTool as any,
        config: {
            tools: buildLayoutNestedTools(),
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.DISCLOSURE,
        tool: DisclosureTool as any,
        config: {} as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.STEPS,
        tool: StepsTool as any,
        config: {} as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.MEDIA_EMBED,
        tool: MediaEmbedTool as any,
        config: {} as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.MEDIA_GALLERY,
        tool: MediaGalleryTool as any,
        config: {} as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.FAQ,
        tool: FaqTool as any,
        config: {
            questionPlaceholder: 'Enter the question...',
            answerPlaceholder: 'Enter the answer...',
            defaultStyle: 'accordion',
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.IMAGE_HOTSPOTS,
        tool: ImageHotspotsTool as any,
        config: {} as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.TESTIMONIAL,
        tool: TestimonialTool as any,
        config: {
            defaultVariant: 'card',
        } as any,
    },
    {
        name: DEFAULT_PLUGIN_NAMES.REFERENCES,
        tool: ReferencesTool as any,
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
    AnnotationTool,
    BeforeAfterTool,
    CheckList,
    CodeTool,
    CTATool,
    Delimiter,
    DisclosureTool,
    Embed,
    FaqTool,
    Header,
    ImageHotspotsTool,
    InlineCode,
    LayoutTool,
    LinkTool,
    MapTool,
    MediaGalleryTool,
    Marker,
    NestedList,
    Paragraph,
    Quote,
    Raw,
    ReferencesTool,
    ReviewTool,
    SpoilerTool,
    StepsTool,
    Table,
    TestimonialTool,
    Underline,
    Warning,
};
