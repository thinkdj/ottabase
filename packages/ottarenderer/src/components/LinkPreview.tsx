import { safeUrl } from '../inline';
import type { BlockRenderer } from '../types';

/** @editorjs/link output: the URL plus whatever the preview endpoint returned */
export interface LinkPreviewData {
    link?: string;
    meta?: {
        title?: string;
        description?: string;
        site_name?: string;
        image?: { url?: string } | string;
    };
}

const hostOf = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
};

/** A link preview card: image, title, description and the site it points at. */
const LinkPreview: BlockRenderer<LinkPreviewData> = ({ data }) => {
    const href = safeUrl(data?.link);
    if (!href) return null;
    const meta = data?.meta ?? {};
    const image = safeUrl(typeof meta.image === 'string' ? meta.image : meta.image?.url);
    const host = meta.site_name?.trim() || hostOf(href);
    return (
        <a className="otta-link-card" href={href} target="_blank" rel="noopener noreferrer" data-has-image={!!image}>
            {image && <img className="otta-link-card__image" src={image} alt="" loading="lazy" />}
            <span className="otta-link-card__body">
                <span className="otta-link-card__title">{meta.title?.trim() || host}</span>
                {meta.description?.trim() && (
                    <span className="otta-link-card__description">{meta.description.trim()}</span>
                )}
                <span className="otta-link-card__host">{host}</span>
            </span>
        </a>
    );
};

export default LinkPreview;
