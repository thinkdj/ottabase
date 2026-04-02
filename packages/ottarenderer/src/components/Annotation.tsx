import { useCallback, useState, useRef, useEffect } from 'react';

interface AnnotationProps {
    title: string;
    annotation: string;
    children: React.ReactNode;
}

/**
 * Renders an annotation with a tooltip/popover showing the definition.
 * Used for inline annotations in the rendered content.
 * Supports both hover (desktop) and touch (mobile) interactions.
 */
export default function Annotation({ title, annotation, children }: AnnotationProps) {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsOpen(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
        // Small delay to allow moving mouse to tooltip
        timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
    }, []);

    // Clean up timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return (
        <span
            className="cdc-annotation"
            data-title={title}
            data-annotation={annotation}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={handleMouseEnter}
            onBlur={handleMouseLeave}
            tabIndex={0}
            role="button"
            aria-expanded={isOpen}
            aria-label={`Annotation: ${title}`}
        >
            {children}
            {isOpen && annotation && (
                <span
                    className="cdc-annotation__tooltip"
                    role="tooltip"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    {title && <strong className="cdc-annotation__title">{title}</strong>}
                    <span className="cdc-annotation__text">{annotation}</span>
                </span>
            )}
        </span>
    );
}
