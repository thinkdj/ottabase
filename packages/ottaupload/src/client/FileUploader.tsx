import React, { useRef } from 'react';
import type { FileUploaderProps } from '../types';
import { useFileUpload } from '../hooks/useFileUpload';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { FileUploadList } from './FileUploadList';

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
  disabled = false,
  className = '',
}: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    files,
    isUploading,
    addFiles,
    uploadAll,
    removeFile,
    clearFiles,
    retryUpload,
  } = useFileUpload({
    maxFiles,
    maxFileSize,
    acceptedFileTypes,
    uploadEndpoint,
    autoUpload,
    onUploadComplete,
    onUploadError,
    onUploadProgress,
  });

  const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop } =
    useDragAndDrop({
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

  // Button variant
  if (variant === 'button') {
    return (
      <div className={className}>
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
        <button
          type="button"
          onClick={handleBrowseClick}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Browse files
        </button>

        {files.length > 0 && (
          <div className="mt-4 space-y-4">
            <FileUploadList
              files={files}
              onRemove={removeFile}
              onRetry={retryUpload}
            />
            {!autoUpload && files.some((f) => f.status === 'pending') && (
              <button
                type="button"
                onClick={handleUploadClick}
                disabled={isUploading}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? 'Uploading...' : 'Upload files'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Dropzone variant (default)
  return (
    <div className={className}>
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

      {/* Dropzone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        className={`
          relative flex flex-col items-center justify-center
          min-h-[200px] px-6 py-10
          border-2 border-dashed rounded-lg
          cursor-pointer transition-all
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Upload Icon */}
        <div
          className={`
          w-12 h-12 mb-4 rounded-full flex items-center justify-center
          ${isDragging ? 'bg-blue-100' : 'bg-white'}
          border-2
          ${isDragging ? 'border-blue-500' : 'border-gray-200'}
        `}
        >
          <svg
            className={`w-6 h-6 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {isDragging ? 'Drop files here' : 'Browse file to upload'}
          </p>
          <p className="text-xs text-gray-500">
            {maxFiles > 1 ? `Up to ${maxFiles} files` : 'Single file'}
            {maxFileSize && ` • Max ${formatBytes(maxFileSize)}`}
          </p>
          {acceptedFileTypes && acceptedFileTypes.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {acceptedFileTypes.join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-4">
          <FileUploadList files={files} onRemove={removeFile} onRetry={retryUpload} />
          {!autoUpload && files.some((f) => f.status === 'pending') && (
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={isUploading}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? 'Uploading...' : 'Upload files'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
