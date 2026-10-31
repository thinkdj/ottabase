import { Inline, inlineToText, safeUrl, useLinkRel } from '../inline';
import type { BlockRenderer } from '../types';

/** @editorjs/embed output */
export interface EmbedData {
    service?: string;
    source?: string;
    embed?: string;
    width?: number;
    height?: number;
    caption?: string;
}

/**
 * A third-party embed (YouTube, Vimeo, Twitter, CodePen…). The frame reserves its aspect ratio so
 * the page never jumps, loads lazily, and is capped to a sane height for tall services. An embed
 * URL that fails the URL allowlist falls back to a plain link to the source, never to a frame.
 */
const Embed: BlockRenderer<EmbedData> = ({ data }) => {
    const linkRel = useLinkRel();
    const embed = safeUrl(data?.embed);
    const source = safeUrl(data?.source);
    if (!embed && !source) return null;
    const w = data?.width && data.width > 0 ? data.width : 16;
    const h = data?.height && data.height > 0 ? data.height : 9;
    const title = inlineToText(data?.caption) || `${data?.service ?? 'Embedded'} content`;
    return (
        <figure className="otta-embed" data-service={data?.service}>
            <div className="otta-embed__frame" style={{ aspectRatio: `${w} / ${h}` }}>
                {embed ? (
                    <iframe
                        src={embed}
                        title={title}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                    />
                ) : (
                    <a className="otta-link" href={source!} target="_blank" rel={linkRel(true)}>
                        {source}
                    </a>
                )}
            </div>
            {data?.caption && (
                <figcaption className="otta-caption">
                    <Inline html={data.caption} />
                </figcaption>
            )}
        </figure>
    );
};

export default Embed;
