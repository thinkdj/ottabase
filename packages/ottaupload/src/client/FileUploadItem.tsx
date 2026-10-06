import React from 'react';
import type { UploadFile } from '../types';
import { formatFileSize } from '../validation';

export interface FileUploadItemProps {
    file: UploadFile;
    onRemove?: (id: string) => void;
    onRetry?: (id: string) => void;
    showRemove?: boolean;
}

const icon = {
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    'aria-hidden': true,
} as const;

export function FileUploadItem({ file, onRemove, onRetry, showRemove = true }: FileUploadItemProps) {
    const statusIcon = {
        success: (
            <svg className="h-5 w-5 text-success" {...icon}>
                <path d="M5 13l4 4L19 7" />
            </svg>
        ),
        error: (
            <svg className="h-5 w-5 text-destructive" {...icon}>
                <path d="M6 18L18 6M6 6l12 12" />
            </svg>
        ),
        uploading: (
            <svg className="h-5 w-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
            </svg>
        ),
        pending: (
            <svg className="h-5 w-5 text-muted-foreground" {...icon}>
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
    }[file.status];

    return (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/40">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                <svg className="h-6 w-6" {...icon}>
                    <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            </div>

            <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{file.file.name}</p>
                    <div className="flex shrink-0 items-center gap-2">
                        {statusIcon}
                        {showRemove && onRemove && (
                            <button
                                type="button"
                                onClick={() => onRemove(file.id)}
                                className="rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`Remove ${file.file.name}`}
                            >
                                <svg className="h-4 w-4" {...icon}>
                                    <path d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                <p className="mb-2 text-xs text-muted-foreground">
                    {formatFileSize(file.file.size)}
                    {file.status === 'uploading' && ` · ${file.progress}%`}
                    {file.status === 'success' && ' · Uploaded'}
                    {file.status === 'error' && file.error && ` · ${file.error}`}
                </p>

                {file.status === 'uploading' && (
                    <div
                        className="h-1.5 w-full rounded-full bg-muted"
                        role="progressbar"
                        aria-label={`Uploading ${file.file.name}`}
                        aria-valuenow={file.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <div
                            className="h-1.5 rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${file.progress}%` }}
                        />
                    </div>
                )}

                {file.status === 'error' && onRetry && (
                    <button
                        type="button"
                        onClick={() => onRetry(file.id)}
                        className="mt-1 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        Retry upload
                    </button>
                )}
            </div>
        </div>
    );
}
