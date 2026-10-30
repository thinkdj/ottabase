/**
 * @ottabase/ottarenderer – renders Editor.js content from @ottabase/ottaeditor, and plain HTML,
 * in the Ottabase visual language. No third-party renderer, no HTML parser dependency: every block
 * and every inline tag is handled here, against the design tokens.
 */
export { hasBlocks, OttaRenderer } from './OttaRenderer';
export type { OttaRendererProps } from './OttaRenderer';
export { blockRenderers } from './renderers';
export { BlockList, collectHeadingIds, slugify, useHeadingId } from './scope';
export {
    Annotation,
    InlineSpoiler,
    decodeEntities,
    Inline,
    inlineToText,
    nodesToText,
    parseInline,
    renderInline,
    renderNodes,
    safeUrl,
    useInline,
} from './inline';
export type { InlineNode } from './inline';
export { HtmlRenderer } from './HtmlRenderer';
export type { HtmlRendererProps } from './HtmlRenderer';
export type { Block, BlockRenderer, BlockRendererProps, BlockRenderers, Injection, RendererData } from './types';

// Block renderers, for direct use or for building a custom renderer map
export { default as AdvancedImageBlock } from './components/AdvancedImage/AdvancedImage';
export { default as BeforeAfter } from './components/BeforeAfter';
export { default as Checklist, CheckMark } from './components/Checklist';
export { default as Code } from './components/Code';
export { default as CTA } from './components/CTA';
export { default as Delimiter } from './components/Delimiter';
export { default as Disclosure } from './components/Disclosure';
export { default as Embed } from './components/Embed';
export { default as Faq } from './components/Faq';
export { default as Header } from './components/Header';
export { default as ImageHotspots } from './components/ImageHotspots';
export { default as Layout } from './components/Layout';
export { default as LinkPreview } from './components/LinkPreview';
export { default as List } from './components/List';
export { default as Map } from './components/Map';
export { default as MediaEmbed } from './components/MediaEmbed';
export { default as MediaGallery } from './components/MediaGallery';
export { default as Paragraph } from './components/Paragraph';
export { default as Quote } from './components/Quote';
export { default as Raw } from './components/Raw';
export { default as References } from './components/References';
export { default as Review } from './components/Review';
export { default as Spoiler } from './components/Spoiler';
export { default as Steps } from './components/Steps';
export { default as Table } from './components/Table';
export { default as Testimonial } from './components/Testimonial';
export { default as Warning } from './components/Warning';

// Block data types
export type { AdvancedImageData, UploadResponse } from './components/AdvancedImage/advancedimage.types';
export type { BeforeAfterData } from './components/BeforeAfter';
export type { ChecklistItem } from './components/Checklist';
export type { CodeBlockData } from './components/Code';
export type { CTAData } from './components/CTA';
export type { DelimiterData } from './components/Delimiter';
export type { AIDisclosureLevel, DisclosureData } from './components/Disclosure';
export type { EmbedData } from './components/Embed';
export type { FaqData, FaqItem } from './components/Faq';
export type { HeaderData } from './components/Header';
export type { HotspotItem, ImageHotspotsData } from './components/ImageHotspots';
export type { LayoutData, LayoutPreset } from './components/Layout';
export type { LinkPreviewData } from './components/LinkPreview';
export type { ListData, ListItem, ListStyle } from './components/List';
export type { MapData, MapProvider, MapTheme } from './components/Map';
export type { MediaEmbedData } from './components/MediaEmbed';
export type { MediaGalleryData, MediaGalleryItem, MediaGalleryLayoutPreset } from './components/MediaGallery';
export type { ParagraphData } from './components/Paragraph';
export type { QuoteData } from './components/Quote';
export type { ReferencesData } from './components/References';
export type { ReviewData } from './components/Review';
export type { StepItem, StepsData } from './components/Steps';
export type { TableData } from './components/Table';
export type { TestimonialData, TestimonialVariant } from './components/Testimonial';
export type { WarningData } from './components/Warning';
