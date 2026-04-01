import { OutputData } from '@editorjs/editorjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultPlugins, getDefaultPlugins, type DefaultPluginName } from './defaultPlugins';
import { exportToJSON, exportToMarkdown } from './export';
import { OttaEditor } from './OttaEditor';
import type { OttaEditorConfig, OttaEditorPlugin } from './types';

export interface UseOttaEditorOptions extends Omit<OttaEditorConfig, 'holder'> {
    /**
     * Plugins to register before initialization
     * If not provided, defaultPlugins will be used
     * Set to empty array [] to use no plugins
     * Pass custom plugins to extend or replace default ones
     */
    plugins?: OttaEditorPlugin[];

    /**
     * Select which default plugins to load
     * - 'all': Load all default plugins (default behavior)
     * - Array of plugin names: Load only specified default plugins
     * - Use with additionalPlugins to append custom plugins
     *
     * @example
     * // Load all default plugins
     * defaultPlugins: 'all'
     *
     * @example
     * // Load only specific default plugins
     * defaultPlugins: ['header', 'paragraph', 'list']
     */
    defaultPlugins?: DefaultPluginName[] | 'all';

    /**
     * Additional custom plugins to append to the default plugins
     * This is useful when you want to keep default plugins and add custom ones
     *
     * @example
     * additionalPlugins: [
     *   { name: 'myCustomTool', tool: MyCustomTool, config: {...} }
     * ]
     */
    additionalPlugins?: OttaEditorPlugin[];

    /**
     * Enable editor on mount
     */
    enableOnMount?: boolean;
}

export interface UseOttaEditorReturn {
    /**
     * Ref to attach to the editor container element
     */
    editorRef: React.RefObject<HTMLDivElement | null>;

    /**
     * OttaEditor instance
     */
    editor: OttaEditor | null;

    /**
     * Save editor data
     */
    save: () => Promise<OutputData | null>;

    /**
     * Clear editor content
     */
    clear: () => Promise<void>;

    /**
     * Render new data
     */
    render: (data: OutputData) => Promise<void>;

    /**
     * Toggle read-only mode
     */
    toggleReadOnly: (state?: boolean) => Promise<void>;

    /**
     * Check if editor is ready
     */
    isReady: boolean;

    /**
     * Check if editor has unsaved changes
     * Becomes true when content changes, resets to false after save()
     */
    hasUnsavedChanges: boolean;

    /**
     * Undo the last change
     */
    undo: () => Promise<void>;

    /**
     * Redo the last undone change
     */
    redo: () => Promise<void>;

    /**
     * Whether undo is available
     */
    canUndo: boolean;

    /**
     * Whether redo is available
     */
    canRedo: boolean;

    /**
     * Export editor content as formatted JSON string
     */
    exportJSON: () => Promise<string | null>;

    /**
     * Export editor content as Markdown string
     */
    exportMarkdown: () => Promise<string | null>;
}

/**
 * React hook for using OttaEditor
 */
export function useOttaEditor(options: UseOttaEditorOptions = {}): UseOttaEditorReturn {
    const editorRef = useRef<HTMLDivElement>(null);
    const editorInstanceRef = useRef<OttaEditor | null>(null);
    const initializingRef = useRef(false);
    const [isReady, setIsReady] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const {
        enableOnMount = true,
        plugins,
        defaultPlugins: defaultPluginsConfig,
        additionalPlugins = [],
        ...editorConfig
    } = options;

    // Determine which plugins to use
    const pluginsToRegister: OttaEditorPlugin[] =
        plugins !== undefined
            ? plugins
            : defaultPluginsConfig !== undefined
              ? [...getDefaultPlugins(defaultPluginsConfig), ...additionalPlugins]
              : [...defaultPlugins, ...additionalPlugins];

    useEffect(() => {
        if (!editorRef.current || !enableOnMount || initializingRef.current || editorInstanceRef.current) {
            return;
        }

        // Mark as initializing to prevent double init in StrictMode
        initializingRef.current = true;

        const initEditor = async () => {
            try {
                // Double-check we haven't already initialized
                if (editorInstanceRef.current) {
                    return;
                }

                // Create editor instance
                const editor = new OttaEditor({
                    ...editorConfig,
                    holder: editorRef.current!,
                    onReady: () => {
                        setIsReady(true);
                        editorConfig.onReady?.();
                    },
                    onChange: (api, event) => {
                        setHasUnsavedChanges(true);
                        editorConfig.onChange?.(api, event);
                    },
                    onUndoRedoStateChange: (state) => {
                        setCanUndo(state.canUndo);
                        setCanRedo(state.canRedo);
                    },
                });

                // Register plugins
                if (pluginsToRegister.length > 0) {
                    editor.registerPlugins(pluginsToRegister);
                }

                // Initialize
                await editor.init();
                editorInstanceRef.current = editor;
            } catch (error) {
                console.error('Failed to initialize OttaEditor:', error);
                initializingRef.current = false;
            }
        };

        initEditor();

        // Cleanup on unmount
        return () => {
            if (editorInstanceRef.current) {
                editorInstanceRef.current.destroy().catch(console.error);
                editorInstanceRef.current = null;
                initializingRef.current = false;
                setIsReady(false);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enableOnMount]);

    const save = useCallback(async (): Promise<OutputData | null> => {
        if (!editorInstanceRef.current) {
            console.warn('Editor is not initialized');
            return null;
        }
        try {
            const data = await editorInstanceRef.current.save();
            setHasUnsavedChanges(false);
            return data;
        } catch (error) {
            console.error('Failed to save editor data:', error);
            return null;
        }
    }, []);

    const clear = useCallback(async (): Promise<void> => {
        if (!editorInstanceRef.current) {
            console.warn('Editor is not initialized');
            return;
        }
        try {
            await editorInstanceRef.current.clear();
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Failed to clear editor:', error);
        }
    }, []);

    const render = useCallback(async (data: OutputData): Promise<void> => {
        if (!editorInstanceRef.current) {
            console.warn('Editor is not initialized');
            return;
        }
        try {
            await editorInstanceRef.current.render(data);
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Failed to render editor data:', error);
        }
    }, []);

    const toggleReadOnly = useCallback(async (state?: boolean): Promise<void> => {
        if (!editorInstanceRef.current) {
            console.warn('Editor is not initialized');
            return;
        }
        try {
            await editorInstanceRef.current.toggleReadOnly(state);
        } catch (error) {
            console.error('Failed to toggle read-only mode:', error);
        }
    }, []);

    const undo = useCallback(async (): Promise<void> => {
        if (!editorInstanceRef.current) {
            console.warn('Editor is not initialized');
            return;
        }
        try {
            await editorInstanceRef.current.undo();
        } catch (error) {
            console.error('Failed to undo:', error);
        }
    }, []);

    const redo = useCallback(async (): Promise<void> => {
        if (!editorInstanceRef.current) {
            console.warn('Editor is not initialized');
            return;
        }
        try {
            await editorInstanceRef.current.redo();
        } catch (error) {
            console.error('Failed to redo:', error);
        }
    }, []);

    const exportJSON = useCallback(async (): Promise<string | null> => {
        if (!editorInstanceRef.current) {
            console.warn('Editor is not initialized');
            return null;
        }
        try {
            const data = await editorInstanceRef.current.save();
            return exportToJSON(data);
        } catch (error) {
            console.error('Failed to export JSON:', error);
            return null;
        }
    }, []);

    const exportMd = useCallback(async (): Promise<string | null> => {
        if (!editorInstanceRef.current) {
            console.warn('Editor is not initialized');
            return null;
        }
        try {
            const data = await editorInstanceRef.current.save();
            return exportToMarkdown(data);
        } catch (error) {
            console.error('Failed to export Markdown:', error);
            return null;
        }
    }, []);

    return {
        editorRef,
        editor: editorInstanceRef.current,
        save,
        clear,
        render,
        toggleReadOnly,
        isReady,
        hasUnsavedChanges,
        undo,
        redo,
        canUndo,
        canRedo,
        exportJSON,
        exportMarkdown: exportMd,
    };
}
