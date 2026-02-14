import React from 'react';
import './editorjs-brandkit-theme.css';
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
            className={`ottaeditor-container border border-input rounded-md p-4 bg-background ${className}`}
            style={{
                minHeight: editorOptions.minHeight || 300,
                ...style,
            }}
        />
    );
};

OttaEditorComponent.displayName = 'OttaEditorComponent';
