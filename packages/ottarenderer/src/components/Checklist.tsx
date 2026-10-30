import { Inline } from '../inline';
import type { BlockRenderer } from '../types';

export interface ChecklistItem {
    text: string;
    checked: boolean;
}

/** The read-only check box shared by Checklist and checklist-style List. */
export function CheckMark({ checked }: { checked: boolean }) {
    return (
        <span className="otta-check" data-checked={checked} aria-hidden="true">
            {checked && (
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="m5 12 5 5L20 7" />
                </svg>
            )}
        </span>
    );
}

/** A finished checklist: done items read as done, nothing is clickable. */
const Checklist: BlockRenderer<{ items?: ChecklistItem[] }> = ({ data }) => {
    const items = data?.items ?? [];
    if (items.length === 0) return null;
    return (
        <ul className="otta-checklist">
            {items.map((item, i) => (
                <li key={i} className="otta-checklist__item" data-checked={Boolean(item.checked)}>
                    <CheckMark checked={Boolean(item.checked)} />
                    <span className="otta-sr-only">{item.checked ? 'Done: ' : 'To do: '}</span>
                    <span className="otta-checklist__text">
                        <Inline html={item.text} />
                    </span>
                </li>
            ))}
        </ul>
    );
};

export default Checklist;
