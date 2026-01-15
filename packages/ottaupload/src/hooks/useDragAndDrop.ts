import { useState, useCallback, DragEvent } from 'react';

export interface UseDragAndDropOptions {
  onDrop: (files: File[]) => void;
  accept?: string[];
  multiple?: boolean;
  disabled?: boolean;
}

export function useDragAndDrop(options: UseDragAndDropOptions) {
  const { onDrop, accept, multiple = true, disabled = false } = options;
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      setDragCounter((prev) => prev + 1);
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      setDragCounter((prev) => {
        const newCounter = prev - 1;
        if (newCounter === 0) {
          setIsDragging(false);
        }
        return newCounter;
      });
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      e.dataTransfer.dropEffect = 'copy';
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      setIsDragging(false);
      setDragCounter(0);

      const files = Array.from(e.dataTransfer.files);

      if (files.length > 0) {
        const filteredFiles = multiple ? files : files.slice(0, 1);

        // Filter by accepted types if specified
        const acceptedFiles = accept
          ? filteredFiles.filter((file) => {
              return accept.some((type) => {
                if (type.endsWith('/*')) {
                  const baseType = type.split('/')[0];
                  return file.type.startsWith(baseType + '/');
                }
                return file.type === type;
              });
            })
          : filteredFiles;

        onDrop(acceptedFiles);
      }
    },
    [onDrop, accept, multiple, disabled]
  );

  return {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
