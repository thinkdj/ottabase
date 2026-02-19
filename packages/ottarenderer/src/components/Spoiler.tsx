import { RenderFn } from 'editorjs-blocks-react-renderer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const Spoiler: RenderFn<{ text?: string }> = ({ data, className = '' }) => {
    const [isRevealed, setIsRevealed] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const rafRef = useRef<number | null>(null);
    const lastUpdateRef = useRef<number>(0);
    const pendingPositionRef = useRef<{ x: number; y: number } | null>(null);

    const handleClick = useCallback(() => {
        setIsRevealed((prev) => !prev);
    }, []);

    // Throttled mouse move handler using requestAnimationFrame
    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (isRevealed) return;

            // Capture coordinates immediately
            const x = e.clientX;
            const y = e.clientY;
            pendingPositionRef.current = { x, y };

            const now = Date.now();
            // Throttle to ~60fps (16ms)
            if (now - lastUpdateRef.current < 16) {
                if (rafRef.current === null) {
                    rafRef.current = requestAnimationFrame(() => {
                        if (pendingPositionRef.current) {
                            setTooltipPosition(pendingPositionRef.current);
                            pendingPositionRef.current = null;
                        }
                        rafRef.current = null;
                        lastUpdateRef.current = Date.now();
                    });
                }
            } else {
                setTooltipPosition({ x, y });
                lastUpdateRef.current = now;
            }
        },
        [isRevealed],
    );

    const handleMouseEnter = useCallback(() => {
        if (!isRevealed) {
            setShowTooltip(true);
        }
    }, [isRevealed]);

    const handleMouseLeave = useCallback(() => {
        setShowTooltip(false);
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
            }
        },
        [handleClick],
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, []);

    const spoilerText = data?.text || '';

    // Memoize computed styles
    const textStyle = useMemo(
        () => ({
            filter: isRevealed ? 'none' : 'blur(4px)',
            userSelect: isRevealed ? ('auto' as const) : ('none' as const),
            WebkitUserSelect: isRevealed ? ('auto' as const) : ('none' as const),
            WebkitFilter: isRevealed ? 'none' : 'blur(4px)',
            transition: 'filter 0.3s ease-in-out',
            willChange: 'filter' as const,
        }),
        [isRevealed],
    );

    const tooltipStyle = useMemo(
        () => ({
            left: `${tooltipPosition.x + 10}px`,
            top: `${tooltipPosition.y + 10}px`,
        }),
        [tooltipPosition],
    );

    // Generate structured data for SEO (Schema.org)
    const structuredData = useMemo(() => {
        if (!spoilerText) return null;
        return {
            '@context': 'https://schema.org',
            '@type': 'CreativeWork',
            text: spoilerText,
            interactionType: 'https://schema.org/ReadAction',
        };
    }, [spoilerText]);

    return (
        <>
            {/* Structured data for SEO - hidden from users but visible to crawlers */}
            {structuredData && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                />
            )}
            <span
                onClick={handleClick}
                onMouseMove={handleMouseMove}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={`${className} cursor-pointer select-none inline-block px-1.5 py-0.5 rounded bg-yellow-50 dark:bg-yellow-900/20 transition-colors relative focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800`}
                role="button"
                tabIndex={0}
                onKeyDown={handleKeyDown}
                aria-label={isRevealed ? 'Hide spoiler content' : 'Reveal spoiler content'}
                aria-expanded={isRevealed}
                aria-live="polite"
                itemScope
                itemType="https://schema.org/CreativeWork"
                data-spoiler-content={spoilerText}
            >
                {/* Always render content in HTML for SEO - CSS blur hides it visually */}
                <span
                    className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words"
                    style={textStyle}
                    itemProp="text"
                >
                    {spoilerText || 'Click to reveal'}
                </span>
            </span>
            {/* Noscript fallback for crawlers/users without JS */}
            <noscript>
                <span className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                    {spoilerText || 'Spoiler content'}
                </span>
            </noscript>
            {showTooltip && !isRevealed && (
                <div
                    className="fixed z-50 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-800 rounded shadow-lg pointer-events-none whitespace-nowrap"
                    style={tooltipStyle}
                    role="tooltip"
                    aria-hidden="true"
                >
                    Spoiler - Click to reveal
                </div>
            )}
        </>
    );
};

export default Spoiler;
