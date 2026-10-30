import type { BlockRenderer } from '../types';

/** @editorjs/delimiter saves `{}`; the 2.x tool adds a style and a line width in percent. */
export interface DelimiterData {
    style?: 'star' | 'dash' | 'line';
    lineWidth?: number;
    lineThickness?: number;
}

/** A section break: three quiet dots, a short dash, or a hairline of the chosen width. */
const Delimiter: BlockRenderer<DelimiterData> = ({ data }) => {
    const style = data?.style === 'dash' || data?.style === 'line' ? data.style : 'star';
    const width = style === 'line' && data?.lineWidth ? `${Math.min(100, Math.max(8, data.lineWidth))}%` : undefined;
    const thickness =
        style === 'line' && data?.lineThickness ? `${Math.min(8, Math.max(1, data.lineThickness))}px` : undefined;
    return (
        <hr
            className={`otta-delimiter otta-delimiter--${style}`}
            style={width || thickness ? { width, borderTopWidth: thickness } : undefined}
        />
    );
};

export default Delimiter;
