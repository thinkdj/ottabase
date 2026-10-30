/**
 * Every built-in block renderer, keyed by the Editor.js block type that @ottabase/ottaeditor saves.
 * Spread this into your own map to add a block or replace one.
 */
import AdvancedImage from './components/AdvancedImage/AdvancedImage';
import BeforeAfter from './components/BeforeAfter';
import Checklist from './components/Checklist';
import Code from './components/Code';
import CTA from './components/CTA';
import Delimiter from './components/Delimiter';
import Disclosure from './components/Disclosure';
import Embed from './components/Embed';
import Faq from './components/Faq';
import Header from './components/Header';
import ImageHotspots from './components/ImageHotspots';
import Layout from './components/Layout';
import LinkPreview from './components/LinkPreview';
import List from './components/List';
import Map from './components/Map';
import MediaEmbed from './components/MediaEmbed';
import MediaGallery from './components/MediaGallery';
import Paragraph from './components/Paragraph';
import Quote from './components/Quote';
import Raw from './components/Raw';
import References from './components/References';
import Review from './components/Review';
import Spoiler from './components/Spoiler';
import Steps from './components/Steps';
import Table from './components/Table';
import Testimonial from './components/Testimonial';
import Warning from './components/Warning';
import { registerDefaultRenderers } from './scope';
import type { BlockRenderers } from './types';

export const blockRenderers: BlockRenderers = {
    // Editor.js core and official tools
    paragraph: Paragraph,
    header: Header,
    list: List,
    checklist: Checklist,
    quote: Quote,
    delimiter: Delimiter,
    table: Table,
    code: Code,
    warning: Warning,
    embed: Embed,
    linkTool: LinkPreview,
    raw: Raw,
    image: AdvancedImage,
    // @ottabase/ottaeditor tools
    advancedImage: AdvancedImage,
    beforeAfter: BeforeAfter,
    cta: CTA,
    disclosure: Disclosure,
    faq: Faq,
    imageHotspots: ImageHotspots,
    layout: Layout,
    map: Map,
    mediaEmbed: MediaEmbed,
    mediaGallery: MediaGallery,
    references: References,
    review: Review,
    spoiler: Spoiler,
    steps: Steps,
    testimonial: Testimonial,
};

// A BlockList rendered outside an OttaRenderer still knows every built-in.
registerDefaultRenderers(blockRenderers);
