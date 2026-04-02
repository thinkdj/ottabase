import React from 'react';

interface AnnotationProps {
    title: string;
    annotation: string;
    children: React.ReactNode;
}

/**
 * Renders an annotation with a tooltip/popover showing the definition.
 * Used for inline annotations in the rendered content.
 */
export default function Annotation({ title, annotation, children }: AnnotationProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <span
            className="cdc-annotation"
            data-title={title}
            data-annotation={annotation}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            onClick={() => setIsOpen(!isOpen)}
        >
            {children}
            {isOpen && annotation && (
                <span className="cdc-annotation__tooltip">
                    {title && <strong className="cdc-annotation__title">{title}</strong>}
                    <span className="cdc-annotation__text">{annotation}</span>
                </span>
            )}
        </span>
    );
}
