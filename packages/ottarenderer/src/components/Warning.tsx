import { Inline } from '../inline';
import type { BlockRenderer } from '../types';

export interface WarningData {
    title?: string;
    message?: string;
}

/** A callout the reader should not skip: status tint, icon well, title and message. */
const Warning: BlockRenderer<WarningData> = ({ data }) => {
    if (!data?.title && !data?.message) return null;
    return (
        <aside className="otta-warning not-prose" role="note">
            <span className="otta-warning__icon" aria-hidden="true">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                </svg>
            </span>
            <div className="otta-warning__body">
                {data.title && (
                    <p className="otta-warning__title">
                        <Inline html={data.title} />
                    </p>
                )}
                {data.message && (
                    <p className="otta-warning__text">
                        <Inline html={data.message} />
                    </p>
                )}
            </div>
        </aside>
    );
};

export default Warning;
