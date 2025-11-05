import { OutputData } from "@editorjs/editorjs";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultPlugins,
  getDefaultPlugins,
  type DefaultPluginName,
} from "./defaultPlugins";
import { OttaEditor } from "./OttaEditor";
import type { OttaEditorConfig, OttaEditorPlugin } from "./types";

export interface UseOttaEditorOptions extends Omit<OttaEditorConfig, "holder"> {
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
  defaultPlugins?: DefaultPluginName[] | "all";

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
   * Use default plugins automatically
   * @default true
   * @deprecated Use `defaultPlugins` instead for more control
   */
  useDefaultPlugins?: boolean;

  /**
   * Enable editor on mount
   */
  enableOnMount?: boolean;
}

export interface UseOttaEditorReturn {
  /**
   * Ref to attach to the editor container element
   */
  editorRef: React.RefObject<HTMLDivElement>;

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
}

/**
 * React hook for using OttaEditor
 */
export function useOttaEditor(
  options: UseOttaEditorOptions = {},
): UseOttaEditorReturn {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<OttaEditor | null>(null);
  const initializingRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const {
    enableOnMount = true,
    plugins,
    defaultPlugins: defaultPluginsConfig,
    additionalPlugins = [],
    useDefaultPlugins = true,
    ...editorConfig
  } = options;

  // Determine which plugins to use
  let pluginsToRegister: OttaEditorPlugin[];

  if (plugins !== undefined) {
    // If plugins is explicitly provided, use only those (backward compatibility)
    pluginsToRegister = plugins;
  } else if (defaultPluginsConfig !== undefined) {
    // Use the new defaultPlugins configuration
    const selectedDefaults = getDefaultPlugins(defaultPluginsConfig);
    pluginsToRegister = [...selectedDefaults, ...additionalPlugins];
  } else {
    // Fallback to legacy useDefaultPlugins behavior
    pluginsToRegister = useDefaultPlugins
      ? [...defaultPlugins, ...additionalPlugins]
      : additionalPlugins;
  }

  useEffect(() => {
    if (
      !editorRef.current ||
      !enableOnMount ||
      initializingRef.current ||
      editorInstanceRef.current
    ) {
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
        });

        // Register plugins
        if (pluginsToRegister.length > 0) {
          editor.registerPlugins(pluginsToRegister);
        }

        // Initialize
        await editor.init();
        editorInstanceRef.current = editor;
      } catch (error) {
        console.error("Failed to initialize OttaEditor:", error);
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
      console.warn("Editor is not initialized");
      return null;
    }
    try {
      const data = await editorInstanceRef.current.save();
      setHasUnsavedChanges(false);
      return data;
    } catch (error) {
      console.error("Failed to save editor data:", error);
      return null;
    }
  }, []);

  const clear = useCallback(async (): Promise<void> => {
    if (!editorInstanceRef.current) {
      console.warn("Editor is not initialized");
      return;
    }
    try {
      await editorInstanceRef.current.clear();
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to clear editor:", error);
    }
  }, []);

  const render = useCallback(async (data: OutputData): Promise<void> => {
    if (!editorInstanceRef.current) {
      console.warn("Editor is not initialized");
      return;
    }
    try {
      await editorInstanceRef.current.render(data);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to render editor data:", error);
    }
  }, []);

  const toggleReadOnly = useCallback(async (state?: boolean): Promise<void> => {
    if (!editorInstanceRef.current) {
      console.warn("Editor is not initialized");
      return;
    }
    try {
      await editorInstanceRef.current.toggleReadOnly(state);
    } catch (error) {
      console.error("Failed to toggle read-only mode:", error);
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
  };
}
