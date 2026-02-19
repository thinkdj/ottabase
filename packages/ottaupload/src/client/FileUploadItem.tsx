import React from 'react';
import type { UploadFile } from '../types';
import { formatFileSize } from '../validation';

export interface FileUploadItemProps {
    file: UploadFile;
    onRemove?: (id: string) => void;
    onRetry?: (id: string) => void;
    showRemove?: boolean;
}

export function FileUploadItem({ file, onRemove, onRetry, showRemove = true }: FileUploadItemProps) {
    const getStatusIcon = () => {
        switch (file.status) {
            case 'success':
                return (
                    <svg
                        className="w-5 h-5 text-green-500"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path d="M5 13l4 4L19 7" />
                    </svg>
                );
            case 'error':
                return (
                    <svg
                        className="w-5 h-5 text-red-500"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                );
            case 'uploading':
                return (
                    <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                );
            default:
                return (
                    <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                );
        }
    };

    return (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
            {/* File Icon */}
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-blue-50 rounded">
                <svg
                    className="w-6 h-6 text-blue-500"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.file.name}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {getStatusIcon()}
                        {showRemove && onRemove && (
                            <button
                                type="button"
                                onClick={() => onRemove(file.id)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                                aria-label="Remove file"
                            >
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* File Size and Status */}
                <p className="text-xs text-gray-500 mb-2">
                    {formatFileSize(file.file.size)}
                    {file.status === 'uploading' && ` • ${file.progress}%`}
                    {file.status === 'success' && ' • Uploaded'}
                    {file.status === 'error' && file.error && ` • ${file.error}`}
                </p>

                {/* Progress Bar */}
                {file.status === 'uploading' && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${file.progress}%` }}
                        />
                    </div>
                )}

                {/* Error Actions */}
                {file.status === 'error' && onRetry && (
                    <button
                        type="button"
                        onClick={() => onRetry(file.id)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                    >
                        Retry upload
                    </button>
                )}
            </div>
        </div>
    );
}
