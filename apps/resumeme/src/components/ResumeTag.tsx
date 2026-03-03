import type { HTMLAttributes } from 'react';

interface ResumeTagProps extends HTMLAttributes<HTMLSpanElement> {
    label: string;
}

/** Small pill-style tag used across ResumeMe (status, mode indicators). */
export function ResumeTag({ label, className = '', ...rest }: ResumeTagProps) {
    return (
        <span
            className={`inline-flex items-center rounded px-2.5 py-0.5 text-xs font-normal ${className}`.trim()}
            {...rest}
        >
            {label}
        </span>
    );
}
