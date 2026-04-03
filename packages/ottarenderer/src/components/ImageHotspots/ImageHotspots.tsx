import type { RenderFn } from 'editorjs-blocks-react-renderer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface HotspotItem {
    id: string;
    x: number;
    y: number;
    title: string;
    content: string;
}

/** Image position presets (maps to CSS object-position) */
export type ImagePosition =
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'left'
    | 'center'
    | 'right'
    | 'bottom-left'
    | 'bottom'
    | 'bottom-right';

/** Convert position preset to CSS object-position value */
function positionToCSS(pos: ImagePosition | undefined): string {
    if (!pos) return 'center center';
    const map: Record<ImagePosition, string> = {
        'top-left': 'left top',
        top: 'center top',
        'top-right': 'right top',
        left: 'left center',
        center: 'center center',
        right: 'right center',
        'bottom-left': 'left bottom',
        bottom: 'center bottom',
        'bottom-right': 'right bottom',
    };
    return map[pos] || 'center center';
}

export interface ImageHotspotsData {
    imageUrl?: string;
    alt?: string;
    caption?: string;
    hotspots?: HotspotItem[];
    /** Optional fixed height (e.g., '400px', '50vh') */
    height?: string;
    /** Image fit mode: 'contain' preserves aspect ratio, 'cover' fills container */
    imageFit?: 'contain' | 'cover';
    /** Image position when using cover fit */
    imagePosition?: ImagePosition;
}

/**
 * Renderer for the Image Hotspots block.
 * Displays an image with numbered hotspot markers that reveal tooltips on click.
 */
const ImageHotspots: RenderFn<ImageHotspotsData> = ({ data, className = '' }) => {
    const imageUrl = data?.imageUrl || '';
    const alt = data?.alt || '';
    const caption = data?.caption || '';
    const hotspots = data?.hotspots || [];
    const height = data?.height;
    const imageFit = data?.imageFit || 'contain';
    const imagePosition = data?.imagePosition;

    const [activeId, setActiveId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    if (!imageUrl) return null;

    const handleDotClick = useCallback((id: string) => {
        setActiveId((prev) => (prev === id ? null : id));
    }, []);

    /* Close tooltip when clicking on image (not on dot/tooltip) */
    const handleContainerClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        /* Only close if clicking directly on container or image, not on dots/tooltips */
        if (
            target.classList.contains('cdc-image-hotspots__container') ||
            target.classList.contains('cdc-image-hotspots__image')
        ) {
            setActiveId(null);
        }
    }, []);

    /* Close tooltip on outside click */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setActiveId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    /* Container styles for height and cover mode */
    const containerStyle = useMemo((): React.CSSProperties => {
        const style: React.CSSProperties = {};
        if (height) style.height = height;
        return style;
    }, [height]);

    /* Image styles for cover mode with position */
    const imgStyle = useMemo((): React.CSSProperties | undefined => {
        if (imageFit !== 'cover') return undefined;
        return { objectPosition: positionToCSS(imagePosition) };
    }, [imageFit, imagePosition]);

    const containerClasses = [
        'cdc-image-hotspots__container',
        imageFit === 'cover' && 'cdc-image-hotspots__container--cover',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <figure className={`${className} cdc-content-block cdc-image-hotspots`}>
            <div ref={containerRef} className={containerClasses} style={containerStyle} onClick={handleContainerClick}>
                <img
                    src={imageUrl}
                    alt={alt}
                    className="cdc-image-hotspots__image"
                    style={imgStyle}
                    draggable={false}
                />

                {hotspots.map((hs, idx) => (
                    <div
                        key={hs.id || idx}
                        className={`cdc-image-hotspots__dot${activeId === hs.id ? ' cdc-image-hotspots__dot--active' : ''}`}
                        style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                        role="button"
                        aria-expanded={activeId === hs.id}
                        aria-label={hs.title || `Hotspot ${idx + 1}`}
                        tabIndex={0}
                        onClick={() => handleDotClick(hs.id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleDotClick(hs.id);
                            }
                        }}
                    >
                        <span className="cdc-image-hotspots__dot-number">{idx + 1}</span>

                        {/* Tooltip */}
                        {activeId === hs.id && (hs.title || hs.content) && (
                            <div className="cdc-image-hotspots__tooltip" role="tooltip">
                                {hs.title && <strong className="cdc-image-hotspots__tooltip-title">{hs.title}</strong>}
                                {hs.content && <p className="cdc-image-hotspots__tooltip-content">{hs.content}</p>}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {caption && <figcaption className="cdc-image-hotspots__caption">{caption}</figcaption>}
        </figure>
    );
};

export default ImageHotspots;
