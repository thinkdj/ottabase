import { useState, useCallback, useRef, useEffect } from 'react';
import { SplitType } from '../types';

interface UseSplitPaneProps {
    split: SplitType;
    defaultSize: string | number;
    minSize: number;
    maxSize?: number;
    snapPoints?: number[];
    snapThreshold: number;
    onChange?: (size: number) => void;
}

export function useSplitPane({
    split,
    defaultSize,
    minSize,
    maxSize,
    snapPoints = [],
    snapThreshold,
    onChange,
}: UseSplitPaneProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [pane1Size, setPane1Size] = useState<number>(() => {
        if (typeof defaultSize === 'string' && defaultSize.endsWith('%')) {
            return parseFloat(defaultSize);
        }
        return typeof defaultSize === 'number' ? defaultSize : 50;
    });
    const [isPercentage, setIsPercentage] = useState(() => {
        return typeof defaultSize === 'string' && defaultSize.endsWith('%');
    });

    const findNearestSnapPoint = useCallback(
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

    const handleMouseDown = useCallback(() => {
        setIsDragging(true);
    }, []);

    const handleMouseMove = useCallback(
        (event: MouseEvent) => {
            if (!isDragging || !containerRef.current) return;

            const container = containerRef.current;
            const rect = container.getBoundingClientRect();

            let newSize: number;

            if (split === 'vertical') {
                const mouseX = event.clientX - rect.left;
                newSize = isPercentage ? (mouseX / rect.width) * 100 : mouseX;
            } else {
                const mouseY = event.clientY - rect.top;
                newSize = isPercentage ? (mouseY / rect.height) * 100 : mouseY;
            }

            // Apply snap points (only for pixel values)
            if (!isPercentage) {
                newSize = findNearestSnapPoint(newSize);
            }

            // Apply min/max constraints
            const containerSize = split === 'vertical' ? rect.width : rect.height;
            const actualMinSize = isPercentage ? (minSize / containerSize) * 100 : minSize;
            const actualMaxSize = maxSize
                ? isPercentage
                    ? (maxSize / containerSize) * 100
                    : maxSize
                : isPercentage
                  ? 100
                  : containerSize;

            newSize = Math.max(actualMinSize, Math.min(actualMaxSize, newSize));

            setPane1Size(newSize);
            onChange?.(newSize);
        },
        [isDragging, split, minSize, maxSize, isPercentage, findNearestSnapPoint, onChange],
    );

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return {
        containerRef,
        pane1Size,
        isPercentage,
        isDragging,
        handleMouseDown,
    };
}
