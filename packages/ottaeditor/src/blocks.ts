/**
 * Every block the editor offers, described once: the name an author sees, what it is for, which
 * group it belongs to, and its icon. The toolbox order, the block palette, the shell headers and
 * the renamed Editor.js tools all read from this list, so a block is named the same way everywhere.
 */
import { icon, toolbox, iconPath, type IconName } from './ui/icons';

export type BlockGroup = 'text' | 'media' | 'layout' | 'embed' | 'engage' | 'trust';

export interface BlockMeta {
    /** Editor.js tool name, also the renderer type */
    type: string;
    title: string;
    description: string;
    group: BlockGroup;
    icon: IconName;
    /** Extra words the palette search matches */
    keywords?: string[];
}

export const BLOCK_GROUPS: ReadonlyArray<{ key: BlockGroup; label: string }> = [
    { key: 'text', label: 'Text' },
    { key: 'media', label: 'Media' },
    { key: 'layout', label: 'Layout' },
    { key: 'embed', label: 'Embeds & code' },
    { key: 'engage', label: 'Engagement' },
    { key: 'trust', label: 'Trust' },
];

/** In toolbox order: most-used writing blocks first, the long tail by group. */
export const BLOCKS: ReadonlyArray<BlockMeta> = [
    // Text
    { type: 'paragraph', title: 'Text', description: 'Plain paragraph', group: 'text', icon: 'text' },
    {
        type: 'header',
        title: 'Heading',
        description: 'Section title, levels 1 to 6',
        group: 'text',
        icon: 'heading',
        keywords: ['h1', 'h2', 'title'],
    },
    {
        type: 'list',
        title: 'List',
        description: 'Bulleted or numbered, nests',
        group: 'text',
        icon: 'list',
        keywords: ['bullet', 'numbered', 'ol', 'ul'],
    },
    {
        type: 'checklist',
        title: 'Checklist',
        description: 'To-dos with done states',
        group: 'text',
        icon: 'checklist',
        keywords: ['todo', 'task'],
    },
    {
        type: 'quote',
        title: 'Quote',
        description: 'Pull quote with attribution',
        group: 'text',
        icon: 'quote',
        keywords: ['blockquote', 'cite'],
    },
    {
        type: 'warning',
        title: 'Callout',
        description: 'A note the reader should not skip',
        group: 'text',
        icon: 'callout',
        keywords: ['alert', 'note', 'warning'],
    },
    {
        type: 'spoiler',
        title: 'Spoiler',
        description: 'Blurred until the reader clicks',
        group: 'text',
        icon: 'spoiler',
        keywords: ['hidden', 'reveal'],
    },
    {
        type: 'delimiter',
        title: 'Divider',
        description: 'A quiet break between sections',
        group: 'text',
        icon: 'divider',
        keywords: ['separator', 'hr'],
    },
    // Media
    {
        type: 'image',
        title: 'Image',
        description: 'Upload, paste a URL, or pick from the library',
        group: 'media',
        icon: 'image',
        keywords: ['photo', 'picture', 'figure'],
    },
    {
        type: 'mediaLibrary',
        title: 'From library',
        description: 'Insert any upload: images, video, audio, files',
        group: 'media',
        icon: 'library',
        keywords: ['media', 'upload', 'file'],
    },
    {
        type: 'mediaGallery',
        title: 'Gallery',
        description: 'Several images in one of five layouts',
        group: 'media',
        icon: 'gallery',
        keywords: ['photos', 'grid', 'masonry'],
    },
    {
        type: 'mediaEmbed',
        title: 'Video & files',
        description: 'Video, audio, PDF or document with a player',
        group: 'media',
        icon: 'media',
        keywords: ['video', 'audio', 'pdf', 'document'],
    },
    {
        type: 'beforeAfter',
        title: 'Before / after',
        description: 'Two images with a comparison slider',
        group: 'media',
        icon: 'compare',
        keywords: ['comparison', 'slider'],
    },
    {
        type: 'imageHotspots',
        title: 'Hotspots',
        description: 'An image with numbered markers and notes',
        group: 'media',
        icon: 'hotspots',
        keywords: ['annotate', 'markers', 'pins'],
    },
    // Layout
    {
        type: 'layout',
        title: 'Columns',
        description: 'Two or three columns of blocks',
        group: 'layout',
        icon: 'columns',
        keywords: ['grid', 'side by side'],
    },
    {
        type: 'table',
        title: 'Table',
        description: 'Rows and columns, optional header row',
        group: 'layout',
        icon: 'table',
    },
    // Embeds & code
    {
        type: 'embed',
        title: 'Embed',
        description: 'YouTube, Vimeo, X, CodePen and more',
        group: 'embed',
        icon: 'embed',
        keywords: ['youtube', 'vimeo', 'twitter', 'iframe'],
    },
    {
        type: 'linkTool',
        title: 'Link preview',
        description: 'A card for a URL: title, description, image',
        group: 'embed',
        icon: 'link',
        keywords: ['bookmark', 'url'],
    },
    {
        type: 'map',
        title: 'Map',
        description: 'Google Maps or OpenStreetMap',
        group: 'embed',
        icon: 'map',
        keywords: ['location', 'osm'],
    },
    {
        type: 'code',
        title: 'Code',
        description: 'Highlighted source with line numbers',
        group: 'embed',
        icon: 'code',
        keywords: ['snippet', 'pre'],
    },
    {
        type: 'raw',
        title: 'HTML',
        description: 'Raw markup, sanitised on save',
        group: 'embed',
        icon: 'html',
        keywords: ['raw', 'markup'],
    },
    // Engagement
    {
        type: 'cta',
        title: 'Button',
        description: 'A call to action that links somewhere',
        group: 'engage',
        icon: 'cta',
        keywords: ['cta', 'call to action', 'link button'],
    },
    {
        type: 'steps',
        title: 'Steps',
        description: 'A numbered walkthrough',
        group: 'engage',
        icon: 'steps',
        keywords: ['tutorial', 'how to', 'timeline'],
    },
    {
        type: 'faq',
        title: 'FAQ',
        description: 'Questions and answers, accordion or flat',
        group: 'engage',
        icon: 'faq',
        keywords: ['questions', 'accordion'],
    },
    // Trust
    {
        type: 'testimonial',
        title: 'Testimonial',
        description: 'A customer quote in one of five styles',
        group: 'trust',
        icon: 'testimonial',
        keywords: ['quote', 'customer', 'social proof'],
    },
    {
        type: 'review',
        title: 'Review',
        description: 'Rating, pros and cons, verdict',
        group: 'trust',
        icon: 'review',
        keywords: ['rating', 'stars', 'pros', 'cons'],
    },
    {
        type: 'references',
        title: 'References',
        description: 'Numbered sources or footnotes',
        group: 'trust',
        icon: 'references',
        keywords: ['citations', 'bibliography', 'sources'],
    },
    {
        type: 'disclosure',
        title: 'Disclosure',
        description: 'AI-use and sponsorship notices',
        group: 'trust',
        icon: 'disclosure',
        keywords: ['ai', 'sponsored', 'transparency'],
    },
];

const byType = new Map(BLOCKS.map((b) => [b.type, b]));

export function blockMeta(type: string): BlockMeta | undefined {
    return byType.get(type);
}

/** The `static get toolbox()` entry for a custom tool, from the registry */
export function toolboxEntry(type: string): { title: string; icon: string } {
    const meta = byType.get(type);
    return meta
        ? { title: meta.title, icon: toolbox(iconPath(meta.icon)) }
        : { title: type, icon: toolbox(iconPath('text')) };
}

/** Editor.js i18n `toolNames`: the official tools renamed to match the registry */
export function toolNames(): Record<string, string> {
    const names: Record<string, string> = {};
    for (const b of BLOCKS) names[officialToolTitle(b.type) ?? b.title] = b.title;
    return names;
}

/** The titles the official @editorjs tools give themselves, so i18n can map them */
function officialToolTitle(type: string): string | undefined {
    const titles: Record<string, string> = {
        paragraph: 'Text',
        header: 'Heading',
        list: 'List',
        checklist: 'Checklist',
        quote: 'Quote',
        warning: 'Warning',
        delimiter: 'Delimiter',
        table: 'Table',
        embed: 'Embed',
        linkTool: 'Link',
    };
    return titles[type];
}

export { icon as blockIcon };
