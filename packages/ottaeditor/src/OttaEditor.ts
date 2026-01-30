import EditorJS, { OutputData } from '@editorjs/editorjs';
import type { OttaEditorConfig, OttaEditorPlugin, IOttaEditor, OttaEditorTools } from './types';

/**
 * OttaEditor - A flexible wrapper around EditorJS with easy plugin management
 */
export class OttaEditor implements IOttaEditor {
    private editor: EditorJS | null = null;
    private config: OttaEditorConfig;
    private plugins: Map<string, OttaEditorPlugin> = new Map();
    private isInitialized = false;

    constructor(config: OttaEditorConfig) {
        this.config = config;
    }

    /**
     * Initialize the editor with the provided configuration
     */
    async init(): Promise<void> {
        if (this.isInitialized) {
            console.warn('OttaEditor is already initialized');
            return;
        }

        // Merge registered plugins with provided tools
        const tools: OttaEditorTools = { ...this.config.tools };

        this.plugins.forEach((plugin) => {
            tools[plugin.name] = {
                class: plugin.tool,
                config: plugin.config,
            };
        });

        // Create EditorJS instance
        this.editor = new EditorJS({
            holder: this.config.holder,
            data: this.config.data,
            tools: tools as any,
            placeholder: this.config.placeholder,
            autofocus: this.config.autofocus,
            readOnly: this.config.readOnly,
            minHeight: this.config.minHeight,
            logLevel: this.config.logLevel as any,
            onReady: () => {
                this.isInitialized = true;
                this.config.onReady?.();
            },
            onChange: this.config.onChange as any,
            defaultBlock: this.config.defaultBlock,
            i18n: this.config.i18n as any,
        });

        await this.editor.isReady;
    }

    /**
     * Register a plugin/tool before initialization
     * This is useful for extending the editor with custom tools
     */
    registerPlugin(plugin: OttaEditorPlugin): void {
        if (this.isInitialized) {
            throw new Error(
                'Cannot register plugins after editor initialization. Register plugins before calling init()',
            );
        }
        this.plugins.set(plugin.name, plugin);
    }

    /**
     * Register multiple plugins at once
     */
    registerPlugins(plugins: OttaEditorPlugin[]): void {
        plugins.forEach((plugin) => this.registerPlugin(plugin));
    }

    /**
     * Get the underlying EditorJS instance
     */
    getInstance(): EditorJS | null {
        return this.editor;
    }

    /**
     * Save current editor data
     */
    async save(): Promise<OutputData> {
        if (!this.editor) {
            throw new Error('Editor is not initialized');
        }
        return await this.editor.save();
    }

    /**
     * Clear editor content
     */
    async clear(): Promise<void> {
        if (!this.editor) {
            throw new Error('Editor is not initialized');
        }
        await this.editor.clear();
    }

    /**
     * Render new data in the editor
     */
    async render(data: OutputData): Promise<void> {
        if (!this.editor) {
            throw new Error('Editor is not initialized');
        }
        await this.editor.render(data);
    }

    /**
     * Destroy the editor instance and cleanup
     */
    async destroy(): Promise<void> {
        if (!this.editor) {
            return;
        }
        await this.editor.destroy();
        this.editor = null;
        this.isInitialized = false;
    }

    /**
     * Wait for editor to be ready
     */
    async isReady(): Promise<void> {
        if (!this.editor) {
            throw new Error('Editor is not initialized');
        }
        await this.editor.isReady;
    }

    /**
     * Check if editor is in read-only mode
     */
    get readOnly(): boolean {
        return this.config.readOnly ?? false;
    }

    /**
     * Toggle read-only mode
     */
    async toggleReadOnly(state?: boolean): Promise<void> {
        if (!this.editor) {
            throw new Error('Editor is not initialized');
        }
        const readOnlyState = state ?? !this.config.readOnly;
        this.config.readOnly = readOnlyState;
        await this.editor.readOnly.toggle(readOnlyState);
    }
}
