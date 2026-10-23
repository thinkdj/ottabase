'use client';

import * as React from 'react';

export type SplitType = 'vertical' | 'horizontal';

export interface SplitPaneProps {
    /** Direction of the split (vertical = left/right, horizontal = top/bottom) */
    split?: SplitType;
    /** Initial size of the first pane: `'30%'`, `'200px'` or `200` (px) */
    defaultSize?: string | number;
    /** Minimum width of the first pane in pixels (vertical split) */
    minWidth?: number;
    /** Maximum width of the first pane in pixels (vertical split) */
    maxWidth?: number;
    /** Minimum height of the first pane in pixels (horizontal split) */
    minHeight?: number;
    /** Maximum height of the first pane in pixels (horizontal split) */
    maxHeight?: number;
    /** Snap positions in pixels */
    snapPoints?: number[];
    /** Distance to a snap point, in pixels, before snapping */
    snapThreshold?: number;
    /** Called with the new size whenever it changes */
    onChange?: (size: number) => void;
    /** Additional class for the container */
    className?: string;
    /** Additional class for the resizer */
    resizerClassName?: string;
    /** Custom styles for the container */
    style?: React.CSSProperties;
    /** Custom styles for pane 1 */
    pane1Style?: React.CSSProperties;
    /** Custom styles for pane 2 */
    pane2Style?: React.CSSProperties;
    /** Custom styles for the resizer */
    resizerStyle?: React.CSSProperties;
    /** Exactly two children to split */
    children: [React.ReactNode, React.ReactNode] | React.ReactNode;
}

/** '30%' → percent; 200, '200' or '200px' → pixels; anything unparseable → 50%. */
export function parseDefaultSize(value: string | number): { size: number; isPercentage: boolean } {
    if (typeof value === 'number') return { size: value, isPercentage: false };
    const size = parseFloat(value);
    if (!Number.isFinite(size)) return { size: 50, isPercentage: true };
    return { size, isPercentage: value.trim().endsWith('%') };
}

interface UseSplitPaneOptions {
    split: SplitType;
    defaultSize: string | number;
    minSize: number;
    maxSize?: number;
    snapPoints?: number[];
    snapThreshold: number;
    onChange?: (size: number) => void;
}

function useSplitPane({
    split,
    defaultSize,
    minSize,
    maxSize,
    snapPoints = [],
    snapThreshold,
    onChange,
}: UseSplitPaneOptions) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const isDraggingRef = React.useRef(false);
    const [isDragging, setIsDragging] = React.useState(false);
    const [pane1Size, setPane1Size] = React.useState<number>(() => parseDefaultSize(defaultSize).size);
    const [isPercentage, setIsPercentage] = React.useState(() => parseDefaultSize(defaultSize).isPercentage);

    // Sync isPercentage and pane1Size when defaultSize switches unit
    React.useEffect(() => {
        const parsed = parseDefaultSize(defaultSize);
        if (parsed.isPercentage !== isPercentage) {
            setIsPercentage(parsed.isPercentage);
            setPane1Size(parsed.size);
        }
    }, [defaultSize, isPercentage]);

    const findNearestSnapPoint = React.useCallback(
        (position: number): number => {
            if (!snapPoints.length) return position;

            for (const snapPoint of snapPoints) {
                if (Math.abs(position - snapPoint) <= snapThreshold) {
                    return snapPoint;
                }
            }
            return position;
        },
        [snapPoints, snapThreshold],
    );

    /** Snap (pixel sizes only), then clamp to the min/max bounds for this container size. */
    const constrain = React.useCallback(
        (size: number, containerSize: number): number => {
            const snapped = isPercentage ? size : findNearestSnapPoint(size);
            const actualMinSize = isPercentage ? (minSize / containerSize) * 100 : minSize;
            const actualMaxSize = maxSize
                ? isPercentage
                    ? (maxSize / containerSize) * 100
                    : maxSize
                : isPercentage
                  ? 100
                  : containerSize;
            return Math.max(actualMinSize, Math.min(actualMaxSize, snapped));
        },
        [isPercentage, findNearestSnapPoint, minSize, maxSize],
    );

    const handleMouseDown = React.useCallback(() => {
        isDraggingRef.current = true;
        setIsDragging(true);
    }, []);

    const handleMouseMove = React.useCallback(
        (event: MouseEvent) => {
            if (!isDraggingRef.current || !containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            const containerSize = split === 'vertical' ? rect.width : rect.height;
            const pointer = split === 'vertical' ? event.clientX - rect.left : event.clientY - rect.top;
            const newSize = constrain(isPercentage ? (pointer / containerSize) * 100 : pointer, containerSize);

            setPane1Size(newSize);
            onChange?.(newSize);
        },
        [split, isPercentage, constrain, onChange],
    );

    const handleKeyDown = React.useCallback(
        (event: React.KeyboardEvent) => {
            if (!containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            const containerSize = split === 'vertical' ? rect.width : rect.height;
            const step = isPercentage ? 1 : 10; // 1% or 10px per key press

            let delta: number;
            switch (event.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                    delta = -step;
                    break;
                case 'ArrowRight':
                case 'ArrowDown':
                    delta = step;
                    break;
                case 'Home':
                    delta = minSize - pane1Size;
                    break;
                case 'End':
                    delta = (maxSize ?? (isPercentage ? 100 : containerSize)) - pane1Size;
                    break;
                default:
                    return;
            }
            event.preventDefault();

            const newSize = constrain(pane1Size + delta, containerSize);
            setPane1Size(newSize);
            onChange?.(newSize);
        },
        [split, minSize, maxSize, isPercentage, constrain, onChange, pane1Size],
    );

    const handleMouseUp = React.useCallback(() => {
        isDraggingRef.current = false;
        setIsDragging(false);
    }, []);

    React.useEffect(() => {
        if (!isDragging) return;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return { containerRef, pane1Size, isPercentage, isDragging, handleMouseDown, handleKeyDown };
}

const baseStyles: Record<string, React.CSSProperties> = {
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
        // Quiet hairline gutter: a single centered token-driven divider, no fill.
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

function SplitPane({
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
}: SplitPaneProps) {
    const [isHovering, setIsHovering] = React.useState(false);

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

    // Without a max constraint the separator reports 100 (percent, or a nominal pixel ceiling)
    const ariaValueMax = effectiveMaxSize || 100;

    const childrenArray = React.Children.toArray(children);
    if (childrenArray.length !== 2) {
        console.warn('SplitPane requires exactly 2 children');
        return null;
    }

    const [pane1, pane2] = childrenArray;

    const containerStyle: React.CSSProperties = {
        ...baseStyles.container,
        flexDirection: split === 'vertical' ? 'row' : 'column',
        ...style,
    };

    const pane1SizeStyle: React.CSSProperties = {
        ...baseStyles.pane,
        [split === 'vertical' ? 'width' : 'height']: isPercentage ? `${pane1Size}%` : `${pane1Size}px`,
        ...pane1Style,
    };

    const pane2SizeStyle: React.CSSProperties = {
        ...baseStyles.pane,
        flex: 1,
        ...pane2Style,
    };

    const resizerBaseStyle: React.CSSProperties = {
        ...baseStyles.resizer,
        ...(split === 'vertical' ? baseStyles.resizerVertical : baseStyles.resizerHorizontal),
        ...(isHovering && !isDragging && baseStyles.resizerHover),
        ...(isDragging && baseStyles.resizerDragging),
        ...resizerStyle,
    };

    return (
        <div ref={containerRef} data-slot="split-pane" className={className} style={containerStyle}>
            <div data-slot="split-pane-pane" style={pane1SizeStyle}>
                {pane1}
            </div>
            <div
                data-slot="split-pane-resizer"
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
            <div data-slot="split-pane-pane" style={pane2SizeStyle}>
                {pane2}
            </div>
        </div>
    );
}

export { SplitPane };
