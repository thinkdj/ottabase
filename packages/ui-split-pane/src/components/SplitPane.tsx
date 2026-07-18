import React, { Children, CSSProperties, useState, useMemo } from 'react';
import { SplitPaneProps } from '../types';
import { useSplitPane } from '../hooks/useSplitPane';

const baseStyles: Record<string, CSSProperties> = {
    container: {
        display: 'flex',
        height: '100%',
        width: '100%',
        position: 'relative',
    },
    pane: {
        overflow: 'auto',
        position: 'relative',
    },
    resizer: {
        // Quiet hairline gutter — a single centered token-driven divider, no fill.
        backgroundColor: 'hsl(var(--border) / 0.6)',
        zIndex: 1,
        boxSizing: 'border-box',
        backgroundClip: 'padding-box',
        cursor: 'col-resize',
        flexShrink: 0,
        transition: 'background-color var(--duration-normal, 200ms) var(--ease, ease)',
    },
    resizerVertical: {
        // 3px transparent guttering on each side keeps the visible divider a 2px hairline.
        width: '8px',
        cursor: 'col-resize',
        borderLeft: '3px solid transparent',
        borderRight: '3px solid transparent',
    },
    resizerHorizontal: {
        height: '8px',
        cursor: 'row-resize',
        borderTop: '3px solid transparent',
        borderBottom: '3px solid transparent',
    },
    resizerHover: {
        // Hover deepens the divider to a primary tint.
        backgroundColor: 'hsl(var(--primary) / 0.4)',
    },
    resizerDragging: {
        // Active drag = solid primary.
        backgroundColor: 'hsl(var(--primary))',
    },
};

export const SplitPane: React.FC<SplitPaneProps> = ({
    split = 'vertical',
    defaultSize = '50%',
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    snapPoints = [],
    snapThreshold = 20,
    onChange,
    className,
    resizerClassName,
    style,
    pane1Style,
    pane2Style,
    resizerStyle,
    children,
}) => {
    const [isHovering, setIsHovering] = useState(false);

    // Determine min/max based on split direction
    const effectiveMinSize = split === 'vertical' ? (minWidth ?? 50) : (minHeight ?? 50);
    const effectiveMaxSize = split === 'vertical' ? maxWidth : maxHeight;

    const { containerRef, pane1Size, isPercentage, isDragging, handleMouseDown, handleKeyDown } = useSplitPane({
        split,
        defaultSize,
        minSize: effectiveMinSize,
        maxSize: effectiveMaxSize,
        snapPoints,
        snapThreshold,
        onChange,
    });

    // Calculate aria-valuemax once
    const ariaValueMax = useMemo(() => {
        if (effectiveMaxSize) return effectiveMaxSize;
        if (isPercentage) return 100;
        // Default to 100 pixels when no max constraint is specified
        return 100;
    }, [effectiveMaxSize, isPercentage]);

    const childrenArray = Children.toArray(children);
    if (childrenArray.length !== 2) {
        console.warn('SplitPane requires exactly 2 children');
        return null;
    }

    const [pane1, pane2] = childrenArray;

    const containerStyle: CSSProperties = {
        ...baseStyles.container,
        flexDirection: split === 'vertical' ? 'row' : 'column',
        ...style,
    };

    const pane1SizeStyle: CSSProperties = {
        ...baseStyles.pane,
        [split === 'vertical' ? 'width' : 'height']: isPercentage ? `${pane1Size}%` : `${pane1Size}px`,
        ...pane1Style,
    };

    const pane2SizeStyle: CSSProperties = {
        ...baseStyles.pane,
        flex: 1,
        ...pane2Style,
    };

    const resizerBaseStyle: CSSProperties = {
        ...baseStyles.resizer,
        ...(split === 'vertical' ? baseStyles.resizerVertical : baseStyles.resizerHorizontal),
        ...(isHovering && !isDragging && baseStyles.resizerHover),
        ...(isDragging && baseStyles.resizerDragging),
        ...resizerStyle,
    };

    return (
        <div ref={containerRef} className={className} style={containerStyle}>
            <div style={pane1SizeStyle}>{pane1}</div>
            <div
                className={resizerClassName}
                style={resizerBaseStyle}
                onMouseDown={handleMouseDown}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                onKeyDown={handleKeyDown}
                role="separator"
                aria-orientation={split === 'vertical' ? 'vertical' : 'horizontal'}
                aria-valuenow={Math.round(pane1Size)}
                aria-valuemin={effectiveMinSize}
                aria-valuemax={ariaValueMax}
                aria-valuetext={isPercentage ? `${Math.round(pane1Size)}%` : `${Math.round(pane1Size)}px`}
                tabIndex={0}
            />
            <div style={pane2SizeStyle}>{pane2}</div>
        </div>
    );
};

SplitPane.displayName = 'SplitPane';
