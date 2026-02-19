import { ReactNode, CSSProperties } from 'react';

export type SplitType = 'vertical' | 'horizontal';

export interface SplitPaneProps {
    /**
     * Direction of the split (vertical = left/right, horizontal = top/bottom)
     */
    split?: SplitType;

    /**
     * Initial size of the first pane (can be px or %)
     */
    defaultSize?: string | number;

    /**
     * @deprecated Use `minWidth` (for vertical splits) or `minHeight` (for horizontal splits) instead.
     * Minimum size of a pane in pixels.
     * This prop is maintained for backwards compatibility and will be removed in a future major version.
     */
    minSize?: number;

    /**
     * @deprecated Use `maxWidth` (for vertical splits) or `maxHeight` (for horizontal splits) instead.
     * Maximum size of a pane in pixels.
     * This prop is maintained for backwards compatibility and will be removed in a future major version.
     */
    maxSize?: number;

    /**
     * Minimum width of the first pane in pixels (for vertical split)
     */
    minWidth?: number;

    /**
     * Maximum width of the first pane in pixels (for vertical split)
     */
    maxWidth?: number;

    /**
     * Minimum height of the first pane in pixels (for horizontal split)
     */
    minHeight?: number;

    /**
     * Maximum height of the first pane in pixels (for horizontal split)
     */
    maxHeight?: number;

    /**
     * Array of snap positions in pixels
     */
    snapPoints?: number[];

    /**
     * Distance to snap point before snapping (in pixels)
     */
    snapThreshold?: number;

    /**
     * Callback when size changes
     */
    onChange?: (size: number) => void;

    /**
     * Additional CSS class for the container
     */
    className?: string;

    /**
     * Additional CSS class for the resizer
     */
    resizerClassName?: string;

    /**
     * Custom styles for the container
     */
    style?: CSSProperties;

    /**
     * Custom styles for pane 1
     */
    pane1Style?: CSSProperties;

    /**
     * Custom styles for pane 2
     */
    pane2Style?: CSSProperties;

    /**
     * Custom styles for the resizer
     */
    resizerStyle?: CSSProperties;

    /**
     * Two child elements to split
     */
    children: [ReactNode, ReactNode] | ReactNode;
}
