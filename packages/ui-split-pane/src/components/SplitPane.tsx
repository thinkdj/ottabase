import React, { Children, CSSProperties } from 'react';
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
        background: '#e0e0e0',
        opacity: 0.5,
        zIndex: 1,
        boxSizing: 'border-box',
        backgroundClip: 'padding-box',
        cursor: 'col-resize',
        flexShrink: 0,
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
        opacity: 1,
        background: '#b0b0b0',
    },
    resizerDragging: {
        opacity: 1,
        background: '#999',
    },
};

export const SplitPane: React.FC<SplitPaneProps> = ({
    split = 'vertical',
    defaultSize = '50%',
    minSize = 50,
    maxSize,
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
    const { containerRef, pane1Size, isPercentage, isDragging, handleMouseDown } = useSplitPane({
        split,
        defaultSize,
        minSize,
        maxSize,
        snapPoints,
        snapThreshold,
        onChange,
    });

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
                role="separator"
                aria-orientation={split === 'vertical' ? 'vertical' : 'horizontal'}
            />
            <div style={pane2SizeStyle}>{pane2}</div>
        </div>
    );
};

SplitPane.displayName = 'SplitPane';
