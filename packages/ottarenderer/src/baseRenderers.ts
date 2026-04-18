/**
 * Base renderers for EditorJS blocks (excluding Layout).
 * Layout is added in EditorJsRenderer to avoid circular dependency:
 * Layout needs these renderers for nested Blocks.
 */
import AdvancedImageBlock from './components/AdvancedImage/AdvancedImage';
import BeforeAfter from './components/BeforeAfter';
import Checklist from './components/Checklist';
import Code from './components/Code';
import CTA from './components/CTA';
import Disclosure from './components/Disclosure';
import Faq from './components/Faq';
import ImageHotspots from './components/ImageHotspots';
import List from './components/List';
import Map from './components/Map';
import MediaEmbed from './components/MediaEmbed';
import MediaGallery from './components/MediaGallery';
import Quote from './components/Quote';
import References from './components/References';
import Review from './components/Review';
import Spoiler from './components/Spoiler';
import Steps from './components/Steps';
import Table from './components/Table';
import Testimonial from './components/Testimonial';
import Warning from './components/Warning';

export const baseRenderers = {
    checklist: Checklist,
    image: AdvancedImageBlock,
    advancedImage: AdvancedImageBlock,
    beforeAfter: BeforeAfter,
    list: List,
    table: Table,
    code: Code,
    warning: Warning,
    quote: Quote,
    spoiler: Spoiler,
    cta: CTA,
    disclosure: Disclosure,
    review: Review,
    map: Map,
    steps: Steps,
    mediaEmbed: MediaEmbed,
    mediaGallery: MediaGallery,
    faq: Faq,
    imageHotspots: ImageHotspots,
    testimonial: Testimonial,
    references: References,
};
