import EditorJS, { OutputData } from '@editorjs/editorjs';
import type { IOttaEditor, OttaEditorConfig, OttaEditorPlugin, OttaEditorTools } from './types';
import type { UndoRedoState } from './undo-redo';
import { UndoRedoManager } from './undo-redo';

/**
 * OttaEditor - A flexible wrapper around EditorJS with easy plugin management
 */
export class OttaEditor implements IOttaEditor {
    private editor: EditorJS | null = null;
    private config: OttaEditorConfig;
    private plugins: Map<string, OttaEditorPlugin> = new Map();
    private isInitialized = false;
    private undoRedoManager: UndoRedoManager | null = null;
    /** Prevents onChange from recording state during programmatic undo/redo renders */
    private isUndoRedoAction = false;
    /** Track whether the user has interacted with the editor since mount */
    private hasUserInteracted = false;

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

        // Initialize undo/redo manager
        this.undoRedoManager = new UndoRedoManager({
            onStateChange: this.config.onUndoRedoStateChange,
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

                // Capture initial state from the editor so undo can always return to baseline.
                if (this.editor && this.undoRedoManager) {
                    this.editor
                        .save()
                        .then((data) => {
                            this.undoRedoManager?.pushStateImmediate(data);
                        })
                        .catch(() => {
                            // Ignore initial snapshot failures; editor remains usable.
                        });
                }

                // Register keyboard shortcuts on the editor holder element
                this.registerKeyboardShortcuts();
                this.registerInteractionTracking();

                this.config.onReady?.();
            },
            onChange: async (api, event) => {
                // Skip recording during programmatic undo/redo renders
                if (!this.isUndoRedoAction && this.editor && this.undoRedoManager && this.hasUserInteracted) {
                    const data = await this.editor.save();
                    this.undoRedoManager.pushState(data);
                }
                this.config.onChange?.(api, event);
            },
            defaultBlock: this.config.defaultBlock,
            i18n: this.config.i18n as any,
        });

        await this.editor.isReady;
    }

    /**
     * Register Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y keyboard shortcuts
     */
    private registerKeyboardShortcuts(): void {
        const holder =
            typeof this.config.holder === 'string' ? document.getElementById(this.config.holder) : this.config.holder;

        if (!holder) return;

        holder.addEventListener('keydown', this.handleKeyDown);
    }

    /**
     * Mark first real user interaction so init-time editor mutations don't pollute undo history.
     */
    private registerInteractionTracking(): void {
        const holder =
            typeof this.config.holder === 'string' ? document.getElementById(this.config.holder) : this.config.holder;

        if (!holder) return;

        holder.addEventListener('pointerdown', this.handleInteraction, true);
        holder.addEventListener('keydown', this.handleInteraction, true);
        holder.addEventListener('input', this.handleInteraction, true);
        holder.addEventListener('paste', this.handleInteraction, true);
    }

    private handleInteraction = (): void => {
        this.hasUserInteracted = true;
    };

    /** Bound keydown handler for undo/redo shortcuts */
    private handleKeyDown = (e: KeyboardEvent): void => {
        const isCtrlOrMeta = e.ctrlKey || e.metaKey;
        if (!isCtrlOrMeta) return;

        if (e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo().catch(console.error);
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
            e.preventDefault();
            this.redo().catch(console.error);
        }
    };

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
     * Undo the last change and render the previous state
     */
    async undo(): Promise<void> {
        if (!this.editor || !this.undoRedoManager) return;
        const state = this.undoRedoManager.undo();
        if (state) {
            this.isUndoRedoAction = true;
            try {
                await this.editor.render(state);
            } finally {
                this.isUndoRedoAction = false;
            }
        }
    }

    /**
     * Redo the last undone change and render the next state
     */
    async redo(): Promise<void> {
        if (!this.editor || !this.undoRedoManager) return;
        const state = this.undoRedoManager.redo();
        if (state) {
            this.isUndoRedoAction = true;
            try {
                await this.editor.render(state);
            } finally {
                this.isUndoRedoAction = false;
            }
        }
    }

    /**
     * Get current undo/redo state
     */
    getUndoRedoState(): UndoRedoState {
        if (!this.undoRedoManager) {
            return { canUndo: false, canRedo: false };
        }
        return this.undoRedoManager.getState();
    }

    /**
     * Destroy the editor instance and cleanup
     */
    async destroy(): Promise<void> {
        // Remove keyboard shortcut listener
        const holder =
            typeof this.config.holder === 'string' ? document.getElementById(this.config.holder) : this.config.holder;
        holder?.removeEventListener('keydown', this.handleKeyDown);
        holder?.removeEventListener('pointerdown', this.handleInteraction, true);
        holder?.removeEventListener('keydown', this.handleInteraction, true);
        holder?.removeEventListener('input', this.handleInteraction, true);
        holder?.removeEventListener('paste', this.handleInteraction, true);

        if (this.undoRedoManager) {
            this.undoRedoManager.destroy();
            this.undoRedoManager = null;
        }

        if (!this.editor) {
            return;
        }
        await this.editor.destroy();
        this.editor = null;
        this.isInitialized = false;
        this.hasUserInteracted = false;
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
