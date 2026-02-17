import React, { Children, CSSProperties, useState, useEffect, useMemo } from 'react';
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
        background: 'rgba(0, 0, 0, 0.1)',
        zIndex: 1,
        boxSizing: 'border-box',
        backgroundClip: 'padding-box',
        cursor: 'col-resize',
        flexShrink: 0,
        transition: 'background-color 0.2s ease',
    },
    resizerVertical: {
        width: '8px',
        cursor: 'col-resize',
        borderLeft: '2px solid transparent',
        borderRight: '2px solid transparent',
    },
    resizerHorizontal: {
        height: '8px',
        cursor: 'row-resize',
        borderTop: '2px solid transparent',
        borderBottom: '2px solid transparent',
    },
    resizerHover: {
        background: 'rgba(0, 0, 0, 0.2)',
    },
    resizerDragging: {
        background: 'rgba(0, 0, 0, 0.3)',
    },
};

export const SplitPane: React.FC<SplitPaneProps> = ({
    split = 'vertical',
    defaultSize = '50%',
    minSize,
    maxSize,
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

    // Warn about deprecated props
    useEffect(() => {
        if (minSize !== undefined && (split === 'vertical' ? minWidth === undefined : minHeight === undefined)) {
            console.warn(
                '[SplitPane] The "minSize" prop is deprecated and will be removed in a future major version. ' +
                    `Use "min${split === 'vertical' ? 'Width' : 'Height'}" instead.`,
            );
        }
        if (maxSize !== undefined && (split === 'vertical' ? maxWidth === undefined : maxHeight === undefined)) {
            console.warn(
                '[SplitPane] The "maxSize" prop is deprecated and will be removed in a future major version. ' +
                    `Use "max${split === 'vertical' ? 'Width' : 'Height'}" instead.`,
            );
        }
    }, [minSize, maxSize, minWidth, maxWidth, minHeight, maxHeight, split]);

    // Determine min/max based on split direction
    const effectiveMinSize = split === 'vertical' ? (minWidth ?? minSize ?? 50) : (minHeight ?? minSize ?? 50);
    const effectiveMaxSize = split === 'vertical' ? (maxWidth ?? maxSize) : (maxHeight ?? maxSize);

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
