import React from 'react';
import type { UploadFile } from '../types';
import { FileUploadItem } from './FileUploadItem';

export interface FileUploadListProps {
  files: UploadFile[];
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  showRemove?: boolean;
  className?: string;
}

export function FileUploadList({
  files,
  onRemove,
  onRetry,
  showRemove = true,
  className = '',
}: FileUploadListProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {files.map((file) => (
        <FileUploadItem
          key={file.id}
          file={file}
          onRemove={onRemove}
          onRetry={onRetry}
          showRemove={showRemove}
        />
      ))}
    </div>
  );
}
