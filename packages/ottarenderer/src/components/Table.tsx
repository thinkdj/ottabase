import { RenderFn } from 'editorjs-blocks-react-renderer';

const Table: RenderFn<{ withHeadings?: boolean; content: string[][] }> = ({ data }) => {
    const { withHeadings, content } = data;
    const plainTextContent = content.map((row: string[]) =>
        row.map((cell: string) => cell.replace(/<\/?[^>]+(>|$)/g, '')),
    ); // Strip HTML tags from cells
    const headers = plainTextContent[0];
    const rows = plainTextContent.slice(withHeadings ? 1 : 0);

    return (
        <div className="cdc-content-table overflow-x-auto my-4 rounded-md border border-border">
            <table className="min-w-full divide-y divide-border">
                {withHeadings && (
                    <thead className="bg-muted/50">
                        <tr>
                            {headers.map((header: string, index: number) => (
                                <th key={index} className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody className="bg-background divide-y divide-border">
                    {rows.map((row: string[], rowIndex: number) => (
                        <tr key={rowIndex} className="hover:bg-muted/50 transition-colors">
                            {row.map((cell: string, cellIndex: number) => (
                                <td key={cellIndex} className="px-4 py-3 text-sm text-foreground">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Table;
