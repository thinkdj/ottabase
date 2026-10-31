import type { FileSource } from '@ottabase/utils/media';

export interface AdvancedImageData {
    /** A stored file (an upload or a library pick), or an outside address kept as typed */
    image?: FileSource;
    caption?: string;
    withBorder?: boolean;
    withBackground?: boolean;
    stretched?: boolean;
    alt?: string;
    linkUrl?: string;
    featuredImage?: boolean;
    aspectRatio?: string;
}
