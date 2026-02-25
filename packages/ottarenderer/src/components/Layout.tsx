import Blocks from 'editorjs-blocks-react-renderer';
import { RenderFn } from 'editorjs-blocks-react-renderer';
import { customRenderers, defaultEJSRConfigs } from '../EditorJsRenderer';

export type LayoutPreset = '1-1' | '1-3' | '3-1' | '1-2' | '2-1' | '1-1-1';

interface LayoutColumnData {
    content?: {
        blocks?: any[];
        [key: string]: any;
    };
}

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

    return (
        <div className={`${className} my-6 cdc-content-layout not-prose`} data-layout-preset={preset}>
            <div
                className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full"
                role="region"
                aria-label={`${preset} column layout`}
            >
                {widths.map((width, idx) => {
                    const colData = columns[idx];
                    const blocks = colData?.content?.blocks || [];

                    return (
                        <div
                            key={idx}
                            className="min-w-0"
                            style={{
                                // On small screens the flex column stacks; on sm+ use the preset widths
                                flexBasis: `${width}%`,
                                flexGrow: 0,
                                flexShrink: 0,
                            }}
                            data-col={idx}
                            data-col-width={`${width}%`}
                        >
                            {blocks.length > 0 ? (
                                <Blocks
                                    data={colData?.content as any}
                                    config={defaultEJSRConfigs}
                                    renderers={customRenderers}
                                />
                            ) : (
                                <div className="h-full min-h-12 rounded border border-dashed border-border" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Layout;
