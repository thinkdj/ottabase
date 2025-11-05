/**
 * @ottabase/ottaeditor
 *
 * A flexible EditorJS wrapper with easy plugin management for Ottabase applications
 */

export { OttaEditor } from "./OttaEditor";
export { OttaEditorComponent } from './OttaEditorComponent';
export { useOttaEditor } from "./useOttaEditor";

// Export default plugins configuration
export {
  CheckList,
  CodeTool,
  DEFAULT_PLUGIN_NAMES,
  Delimiter,
  Embed,
  Header,
  InlineCode,
  LinkTool,
  Marker,
  NestedList,
  Paragraph,
  Quote,
  Raw,
  Table,
  Underline,
  Warning,
  defaultPlugins,
  defaultPluginsMap,
  getDefaultPlugins,
} from "./defaultPlugins";

export type { DefaultPluginName } from "./defaultPlugins";

export type {
  IOttaEditor,
  OttaEditorConfig,
  OttaEditorPlugin,
  OttaEditorToolConfig,
  OttaEditorTools,
} from "./types";

export type {
  UseOttaEditorOptions,
  UseOttaEditorReturn,
} from "./useOttaEditor";

export type { OttaEditorComponentProps } from "./OttaEditorComponent";

// Re-export commonly used EditorJS types for convenience
export type {
  API,
  BlockAPI,
  BlockTool,
  BlockToolConstructable,
  BlockToolConstructorOptions,
  BlockToolData,
  OutputBlockData,
  OutputData,
  ToolConfig,
  ToolSettings,
} from "@editorjs/editorjs";

