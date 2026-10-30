import { BlockList } from '../scope';
import type { Block, BlockRenderer } from '../types';

export type LayoutPreset = '1-1' | '1-3' | '3-1' | '1-2' | '2-1' | '1-1-1';

/** Column content from LayoutTool: nested Editor.js output */
interface LayoutColumnData {
    content?: { blocks?: Block[] };
}

export interface LayoutData {
    preset?: LayoutPreset;
    columns?: LayoutColumnData[];
}

/** Preset → column widths in percent */
const PRESET_WIDTHS: Record<LayoutPreset, number[]> = {
    '1-1': [50, 50],
    '1-3': [25, 75],
    '3-1': [75, 25],
    '1-2': [33, 67],
    '2-1': [67, 33],
    '1-1-1': [33, 33, 34],
};

/**
 * Multi-column layout. Columns render through the enclosing OttaRenderer's scope, so nested blocks
 * use the same renderers and share the document's heading ids.
 */
const Layout: BlockRenderer<LayoutData> = ({ data }) => {
    const preset = data?.preset && PRESET_WIDTHS[data.preset] ? data.preset : '1-1';
    const columns = data?.columns ?? [];
    if (!columns.length) return null;
    const widths = PRESET_WIDTHS[preset];
    return (
        <div className="otta-layout not-prose" data-layout-preset={preset} data-col-count={widths.length} role="group">
            {widths.map((width, idx) => {
                const blocks = columns[idx]?.content?.blocks ?? [];
                return (
                    <div key={idx} className="otta-layout__column" style={{ flexBasis: `${width}%` }} data-col={idx}>
                        {blocks.length > 0 ? (
                            <BlockList blocks={blocks} />
                        ) : (
                            <div className="otta-layout__empty" aria-hidden="true" />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default Layout;
