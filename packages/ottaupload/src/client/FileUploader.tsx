import React, { useRef } from 'react';
import type { FileUploaderProps } from '../types';
import { useFileUpload } from '../hooks/useFileUpload';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { FileUploadList } from './FileUploadList';

const BUTTON =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const OUTLINE_BUTTON = `${BUTTON} border border-border bg-background text-foreground hover:bg-muted`;
const PRIMARY_BUTTON = `${BUTTON} w-full bg-primary text-primary-foreground hover:bg-primary/90`;

function UploadIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
        >
            <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
    );
}

export function FileUploader({
    onUpload,
    onUploadComplete,
    onUploadError,
    onUploadProgress,
    variant = 'dropzone',
    maxFiles = 1,
    maxFileSize,
    acceptedFileTypes,
    uploadEndpoint,
    autoUpload = false,
    provider,
    disabled = false,
    className = '',
}: FileUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { files, isUploading, addFiles, uploadAll, removeFile, retryUpload } = useFileUpload({
        maxFiles,
        maxFileSize,
        acceptedFileTypes,
        uploadEndpoint,
        autoUpload,
        provider,
        onUploadComplete,
        onUploadError,
        onUploadProgress,
    });

    const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop } = useDragAndDrop({
        onDrop: (droppedFiles) => {
            if (onUpload) {
                onUpload(droppedFiles);
            } else {
                addFiles(droppedFiles);
            }
        },
        accept: acceptedFileTypes,
        multiple: maxFiles > 1,
        disabled,
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) {
            if (onUpload) {
                onUpload(selectedFiles);
            } else {
                addFiles(selectedFiles);
            }
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleBrowseClick = () => {
        fileInputRef.current?.click();
    };

    const handleUploadClick = async () => {
        if (onUpload && files.length > 0) {
            await onUpload(files.map((f) => f.file));
        } else {
            await uploadAll();
        }
    };

    const input = (
        <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            multiple={maxFiles > 1}
            accept={acceptedFileTypes?.join(',')}
            disabled={disabled}
            className="hidden"
            aria-label="File input"
        />
    );

    const list = files.length > 0 && (
        <div className="mt-4 space-y-4">
            <FileUploadList files={files} onRemove={removeFile} onRetry={retryUpload} />
            {!autoUpload && files.some((f) => f.status === 'pending') && (
                <button type="button" onClick={handleUploadClick} disabled={isUploading} className={PRIMARY_BUTTON}>
                    {isUploading ? 'Uploading…' : 'Upload files'}
                </button>
            )}
        </div>
    );

    if (variant === 'button') {
        return (
            <div className={className}>
                {input}
                <button type="button" onClick={handleBrowseClick} disabled={disabled} className={OUTLINE_BUTTON}>
                    <UploadIcon className="h-5 w-5" />
                    Browse files
                </button>
                {list}
            </div>
        );
    }

    // Dropzone: a real button, so Tab + Enter opens the file dialog and it shows a focus ring
    return (
        <div className={className}>
            {input}
            <button
                type="button"
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={handleBrowseClick}
                disabled={disabled}
                className={`relative flex min-h-[200px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                    isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/40 hover:bg-muted/70'
                }`}
            >
                <span
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                        isDragging
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background text-muted-foreground'
                    }`}
                >
                    <UploadIcon className="h-6 w-6" />
                </span>
                <span className="mb-1 text-sm font-medium text-foreground">
                    {isDragging ? 'Drop files here' : 'Choose a file or drop it here'}
                </span>
                <span className="text-xs text-muted-foreground">
                    {maxFiles > 1 ? `Up to ${maxFiles} files` : 'One file'}
                    {maxFileSize && ` · up to ${formatBytes(maxFileSize)}`}
                </span>
                {acceptedFileTypes && acceptedFileTypes.length > 0 && (
                    <span className="mt-1 text-xs text-muted-foreground/70">{acceptedFileTypes.join(', ')}</span>
                )}
            </button>
            {list}
        </div>
    );
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
