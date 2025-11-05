import React from 'react';
import { useOttaEditor, UseOttaEditorOptions } from './useOttaEditor';

export interface OttaEditorComponentProps extends UseOttaEditorOptions {
  /**
   * Additional class name for the editor container
   */
  className?: string;

  /**
   * Additional inline styles for the editor container
   */
  style?: React.CSSProperties;

  /**
   * Callback when editor instance is created
   */
  onEditorReady?: (editor: any) => void;
}

/**
 * React component wrapper for OttaEditor
 */
export const OttaEditorComponent: React.FC<OttaEditorComponentProps> = ({
  className = '',
  style = {},
  onEditorReady,
  ...editorOptions
}) => {
  const { editorRef, editor, isReady } = useOttaEditor(editorOptions);

  React.useEffect(() => {
    if (isReady && editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [isReady, editor, onEditorReady]);

  return (
    <div
      ref={editorRef}
      className={`ottaeditor-container ${className}`}
      style={{
        minHeight: editorOptions.minHeight || 300,
        border: '1px solid #e5e7eb',
        borderRadius: '0.375rem',
        padding: '1rem',
        ...style,
      }}
    />
  );
};

OttaEditorComponent.displayName = 'OttaEditorComponent';
