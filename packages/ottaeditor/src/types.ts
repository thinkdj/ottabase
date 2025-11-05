import EditorJS, { API, BlockAPI, BlockTool, BlockToolConstructable, OutputData, ToolSettings } from '@editorjs/editorjs';

/**
 * Configuration for a single EditorJS tool/plugin
 */
export interface OttaEditorToolConfig {
  class: BlockToolConstructable | BlockTool;
  config?: ToolSettings;
  shortcut?: string;
  inlineToolbar?: boolean | string[];
  toolbox?: {
    title?: string;
    icon?: string;
  };
}

/**
 * Map of tool names to their configurations
 */
export interface OttaEditorTools {
  [toolName: string]: OttaEditorToolConfig | BlockToolConstructable | BlockTool;
}

/**
 * Configuration options for OttaEditor
 */
export interface OttaEditorConfig {
  /**
   * Target element ID or HTMLElement where editor will be rendered
   */
  holder: string | HTMLElement;

  /**
   * Initial data for the editor
   */
  data?: OutputData;

  /**
   * Editor tools/plugins configuration
   */
  tools?: OttaEditorTools;

  /**
   * Placeholder text when editor is empty
   */
  placeholder?: string;

  /**
   * Enable autofocus on editor mount
   */
  autofocus?: boolean;

  /**
   * Read-only mode
   */
  readOnly?: boolean;

  /**
   * Minimum height of the editor
   */
  minHeight?: number;

  /**
   * Log level for EditorJS
   */
  logLevel?: 'VERBOSE' | 'INFO' | 'WARN' | 'ERROR';

  /**
   * Callback fired when editor is ready
   */
  onReady?: () => void;

  /**
   * Callback fired when content changes
   */
  onChange?: (api: API, event: any) => void;

  /**
   * Default block type
   */
  defaultBlock?: string;

  /**
   * i18n configuration
   */
  i18n?: {
    messages?: Record<string, any>;
    direction?: 'ltr' | 'rtl';
  };
}

/**
 * Plugin registration interface for extending OttaEditor
 */
export interface OttaEditorPlugin {
  name: string;
  tool: BlockToolConstructable | BlockTool;
  config?: ToolSettings;
}

/**
 * Plugin configuration for selecting default plugins
 * Can be 'all' to load all default plugins, or an array of plugin names
 */
export type DefaultPluginConfig = 'all' | string[];

/**
 * OttaEditor instance interface
 */
export interface IOttaEditor {
  /**
   * Get the underlying EditorJS instance
   */
  getInstance(): EditorJS | null;

  /**
   * Save editor data
   */
  save(): Promise<OutputData>;

  /**
   * Clear editor content
   */
  clear(): Promise<void>;

  /**
   * Render new data
   */
  render(data: OutputData): Promise<void>;

  /**
   * Destroy editor instance
   */
  destroy(): Promise<void>;

  /**
   * Register a new plugin/tool
   */
  registerPlugin(plugin: OttaEditorPlugin): void;

  /**
   * Check if editor is ready
   */
  isReady(): Promise<void>;
}
