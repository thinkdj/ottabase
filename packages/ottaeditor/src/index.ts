/**
 * @ottabase/ottaeditor
 *
 * A flexible EditorJS wrapper with easy plugin management for Ottabase applications
 */

export { OttaEditor } from './OttaEditor';
export { OttaEditorComponent } from './OttaEditorComponent';
export { useOttaEditor } from './useOttaEditor';

// Export/import utilities
export { exportToJSON, exportToMarkdown } from './export';

// Undo/redo manager
export { UndoRedoManager } from './undo-redo';
export type { UndoRedoState, UndoRedoManagerOptions } from './undo-redo';

// Export default plugins configuration
export {
    CTATool,
    CheckList,
    CodeTool,
    DEFAULT_PLUGIN_NAMES,
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
    BeforeAfterTool,
    defaultPlugins,
    defaultPluginsMap,
    getDefaultPlugins,
} from './defaultPlugins';

// Export custom tools
export { default as AdvancedImageRenderer } from './tools/AdvancedImageTool/AdvancedImageRenderer';
export { default as AdvancedImageTool } from './tools/AdvancedImageTool/AdvancedImageTool';
export type { AdvancedImageData } from './tools/AdvancedImageTool/types';
export type { AIDisclosureLevel, DisclosureData } from './tools/DisclosureTool/DisclosureTool';
export type { LayoutColumnData, LayoutData, LayoutPreset, LayoutToolConfig } from './tools/LayoutTool/LayoutTool';
export type { MapData, MapProvider, MapTheme, MapToolConfig } from './tools/MapTool/MapTool';
export { default as MediaEmbedTool } from './tools/MediaEmbedTool/MediaEmbedTool';
export type { MediaEmbedData } from './tools/MediaEmbedTool/MediaEmbedTool';
export { default as MediaGalleryTool } from './tools/MediaGalleryTool/MediaGalleryTool';
export type {
    MediaGalleryData,
    MediaGalleryItem,
    MediaGalleryLayoutPreset,
    MediaGalleryToolConfig,
} from './tools/MediaGalleryTool/MediaGalleryTool';
export { default as MediaLibraryTool } from './tools/MediaLibraryTool/MediaLibraryTool';
export { default as RawHtmlTool } from './tools/RawHtmlTool/RawHtmlTool';
export type { StepsData, StepsItem, StepsToolConfig } from './tools/StepsTool/StepsTool';
export type { FaqData, FaqItem, FaqToolConfig } from './tools/FaqTool/FaqTool';
export type { ReferenceItem, ReferencesData, ReferencesToolConfig } from './tools/ReferencesTool/ReferencesTool';
export type {
    TestimonialData,
    TestimonialToolConfig,
    TestimonialVariant,
} from './tools/TestimonialTool/TestimonialTool';
export type { BeforeAfterData, BeforeAfterToolConfig } from './tools/BeforeAfterTool/BeforeAfterTool';
export type {
    HotspotItem,
    ImageHotspotsData,
    ImageHotspotsToolConfig,
} from './tools/ImageHotspotsTool/ImageHotspotsTool';

export type { DefaultPluginName } from './defaultPlugins';

export type { IOttaEditor, OttaEditorConfig, OttaEditorPlugin, OttaEditorToolConfig, OttaEditorTools } from './types';

export type { UseOttaEditorOptions, UseOttaEditorReturn } from './useOttaEditor';

export type { OttaEditorComponentProps } from './OttaEditorComponent';

// Re-export commonly used EditorJS types for convenience
export type {
    API,
    BlockAPI,
    BlockTool,
    BlockToolConstructable,
    BlockToolConstructorOptions,
    BlockToolData,
    OutputBlockData,
    OutputData,
    ToolConfig,
    ToolSettings,
} from '@editorjs/editorjs';
