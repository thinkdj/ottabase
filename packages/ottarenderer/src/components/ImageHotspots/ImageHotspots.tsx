import { useState, useCallback, useRef, useEffect } from 'react';
import type { RenderFn } from 'editorjs-blocks-react-renderer';

export interface HotspotItem {
    id: string;
    x: number;
    y: number;
    title: string;
    content: string;
}

export interface ImageHotspotsData {
    imageUrl?: string;
    alt?: string;
    caption?: string;
    hotspots?: HotspotItem[];
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

    const [activeId, setActiveId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    if (!imageUrl) return null;

    const handleDotClick = useCallback((id: string) => {
        setActiveId((prev) => (prev === id ? null : id));
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

    return (
        <figure className={`${className} cdc-content-block cdc-image-hotspots`}>
            <div ref={containerRef} className="cdc-image-hotspots__container">
                <img src={imageUrl} alt={alt} className="cdc-image-hotspots__image" draggable={false} />

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
