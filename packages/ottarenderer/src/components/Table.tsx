import { sanitizeInlineHtml } from '@ottabase/utils/sanitize';
import { RenderFn } from 'editorjs-blocks-react-renderer';

/** Cells carry Editor.js inline HTML (bold, links, entities); sanitized, then rendered as is */
const Table: RenderFn<{ withHeadings?: boolean; content: string[][] }> = ({ data }) => {
    const { withHeadings, content } = data;
    const rows = withHeadings ? content.slice(1) : content;
    const headers = withHeadings ? content[0] : [];
    const cell = (html: string) => ({ __html: sanitizeInlineHtml(html ?? '') });

    return (
        <div className="cdc-content-table overflow-x-auto my-4 rounded-xl border border-border/60">
            <table className="min-w-full divide-y divide-border/60 not-prose">
                {withHeadings && (
                    <thead className="bg-muted/40">
                        <tr>
                            {headers.map((header: string, index: number) => (
                                <th
                                    key={index}
                                    className="px-4 py-4 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground"
                                    dangerouslySetInnerHTML={cell(header)}
                                />
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody className="bg-background divide-y divide-border/60">
                    {rows.map((row: string[], rowIndex: number) => (
                        <tr key={rowIndex} className="hover:bg-muted/40 transition-colors">
                            {row.map((value: string, cellIndex: number) => (
                                <td
                                    key={cellIndex}
                                    className="px-4 py-3 text-sm text-foreground"
                                    dangerouslySetInnerHTML={cell(value)}
                                />
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Table;
