import Blocks, { RenderFn } from 'editorjs-blocks-react-renderer';
import { baseRenderers } from '../baseRenderers';
import { defaultEJSRConfigs } from '../rendererConfig';

export type LayoutPreset = '1-1' | '1-3' | '3-1' | '1-2' | '2-1' | '1-1-1';

/** Column content structure from LayoutTool (EditorJS OutputData format) */
interface LayoutColumnData {
    content?: {
        blocks?: any[];
        [key: string]: any;
    };
}

/**
 * Layout block data. Matches LayoutTool save output.
 * @property preset - Column width preset (e.g. '1-1' = 50/50)
 * @property columns - Array of column data, each with nested EditorJS content
 */
export interface LayoutData {
    preset?: LayoutPreset;
    columns?: LayoutColumnData[];
}

/** Map preset keys to flex-basis percentages for each column */
const PRESET_WIDTHS: Record<LayoutPreset, number[]> = {
    '1-1': [50, 50],
    '1-3': [25, 75],
    '3-1': [75, 25],
    '1-2': [33, 67],
    '2-1': [67, 33],
    '1-1-1': [33, 33, 34],
};

const Layout: RenderFn<LayoutData> = ({ data, className = '' }) => {
    const preset = data?.preset || '1-1';
    const columns = data?.columns || [];
    const widths = PRESET_WIDTHS[preset] || [50, 50];

    if (!columns.length) return null;

    const colCount = widths.length;

    return (
        <div
            className={`${className} my-6 cdc-content-layout not-prose`}
            data-layout-preset={preset}
            data-col-count={colCount}
        >
            <div
                className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full"
                role="region"
                aria-label={`${preset} column layout`}
            >
                {widths.map((width, idx) => {
                    const colData = columns[idx];
                    const blocks = colData?.content?.blocks || [];
                    const hasContent = blocks.length > 0;

                    return (
                        <div
                            key={idx}
                            className="min-w-0 overflow-hidden"
                            style={{ flexBasis: `${width}%`, flexGrow: 0, flexShrink: 0 }}
                            data-col={idx}
                            data-col-width={`${width}%`}
                        >
                            {hasContent ? (
                                <Blocks
                                    // editorjs-blocks-react-renderer requires `version` to exist on data.
                                    // Column content only carries { blocks } — inject a fallback so the
                                    // renderer doesn't throw "data.version is undefined".
                                    data={{ version: '2.30.0', ...(colData?.content as any) }}
                                    config={defaultEJSRConfigs}
                                    renderers={{ ...baseRenderers, layout: Layout }}
                                />
                            ) : (
                                <div
                                    className="h-full min-h-12 rounded border border-dashed border-border"
                                    aria-hidden="true"
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Layout;
