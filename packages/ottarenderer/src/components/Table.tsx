import { Inline } from '../inline';
import type { BlockRenderer } from '../types';

export interface TableData {
    withHeadings?: boolean;
    stretched?: boolean;
    content?: string[][];
}

/** A data table. Cells keep their inline formatting; the wrapper scrolls instead of breaking the column. */
const Table: BlockRenderer<TableData> = ({ data }) => {
    const rows = (data?.content ?? []).filter((row) => Array.isArray(row));
    if (rows.length === 0) return null;
    const cols = Math.max(...rows.map((r) => r.length));
    const pad = (row: string[]) => Array.from({ length: cols }, (_, i) => row[i] ?? '');
    const head = data?.withHeadings ? pad(rows[0]!) : null;
    const body = data?.withHeadings ? rows.slice(1) : rows;
    return (
        <div className="otta-table-wrap" data-stretched={data?.stretched || undefined}>
            <table className="otta-table">
                {head && (
                    <thead>
                        <tr>
                            {head.map((cell, i) => (
                                <th key={i} scope="col">
                                    <Inline html={cell} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody>
                    {body.map((row, r) => (
                        <tr key={r}>
                            {pad(row).map((cell, c) => (
                                <td key={c}>
                                    <Inline html={cell} />
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
