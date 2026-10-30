import React from 'react';
import { useOttaEditor, UseOttaEditorOptions } from './useOttaEditor';

export interface OttaEditorComponentProps extends UseOttaEditorOptions {
    /** Additional class name for the editor container */
    className?: string;
    /** Additional inline styles for the editor container */
    style?: React.CSSProperties;
    /** Callback when the editor instance is ready */
    onEditorReady?: (editor: ReturnType<typeof useOttaEditor>['editor']) => void;
}

/**
 * Drop-in editor. The canvas styles itself (typography, toolbar chrome) through the `ottaeditor`
 * class the wrapper adds, so mount it bare: no `prose`, no card.
 */
export const OttaEditorComponent: React.FC<OttaEditorComponentProps> = ({
    className = '',
    style = {},
    onEditorReady,
    ...editorOptions
}) => {
    const { editorRef, editor, isReady } = useOttaEditor(editorOptions);

    React.useEffect(() => {
        if (isReady && editor && onEditorReady) onEditorReady(editor);
    }, [isReady, editor, onEditorReady]);

    return (
        <div ref={editorRef} className={className} style={{ minHeight: editorOptions.minHeight || 300, ...style }} />
    );
};

OttaEditorComponent.displayName = 'OttaEditorComponent';
