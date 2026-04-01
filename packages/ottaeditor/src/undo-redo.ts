import type { OutputData } from '@editorjs/editorjs';

/**
 * Represents the current undo/redo availability
 */
export interface UndoRedoState {
    canUndo: boolean;
    canRedo: boolean;
}

export interface UndoRedoManagerOptions {
    /** Maximum number of history entries to keep (default: 50) */
    maxHistory?: number;
    /** Debounce interval in ms for pushState (default: 500) */
    debounceMs?: number;
    /** Callback fired whenever undo/redo availability changes */
    onStateChange?: (state: UndoRedoState) => void;
}

/**
 * UndoRedoManager - Manages undo/redo history for EditorJS OutputData.
 * Deep-clones state on push to avoid reference mutations.
 * Debounces pushState calls to avoid recording every keystroke.
 */
export class UndoRedoManager {
    private history: OutputData[] = [];
    private currentIndex: number = -1;
    private maxHistory: number;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private debounceMs: number;
    private onStateChange?: (state: UndoRedoState) => void;
    private lastState: UndoRedoState = { canUndo: false, canRedo: false };

    constructor(options?: UndoRedoManagerOptions) {
        this.maxHistory = options?.maxHistory ?? 50;
        this.debounceMs = options?.debounceMs ?? 500;
        this.onStateChange = options?.onStateChange;
    }

    /**
     * Push a new state with debouncing.
     * Called on every editor change — batches rapid edits into a single history entry.
     */
    pushState(data: OutputData): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.pushStateImmediate(data);
            this.debounceTimer = null;
        }, this.debounceMs);
    }

    /**
     * Force-push a state without debounce.
     * Used for initial state capture and after undo/redo operations.
     */
    pushStateImmediate(data: OutputData): void {
        const cloned: OutputData = structuredClone(data);

        // If we're not at the end of history, truncate forward history
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        this.history.push(cloned);

        // Enforce max history limit
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(this.history.length - this.maxHistory);
        }

        this.currentIndex = this.history.length - 1;
        this.emitStateChange();
    }

    /**
     * Move back one step in history. Returns the previous state or null if at the beginning.
     */
    undo(): OutputData | null {
        if (!this.canUndo()) return null;

        this.currentIndex--;
        const state = structuredClone(this.history[this.currentIndex]) as OutputData;
        this.emitStateChange();
        return state;
    }

    /**
     * Move forward one step in history. Returns the next state or null if at the end.
     */
    redo(): OutputData | null {
        if (!this.canRedo()) return null;

        this.currentIndex++;
        const state = structuredClone(this.history[this.currentIndex]) as OutputData;
        this.emitStateChange();
        return state;
    }

    /**
     * Returns current undo/redo availability
     */
    getState(): UndoRedoState {
        return {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
        };
    }

    /**
     * Reset all history
     */
    clear(): void {
        this.history = [];
        this.currentIndex = -1;
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.emitStateChange();
    }

    /**
     * Cleanup timers
     */
    destroy(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.onStateChange = undefined;
    }

    private canUndo(): boolean {
        return this.currentIndex > 0;
    }

    private canRedo(): boolean {
        return this.currentIndex < this.history.length - 1;
    }

    /** Notify listener only when state actually changes */
    private emitStateChange(): void {
        const newState = this.getState();
        if (newState.canUndo !== this.lastState.canUndo || newState.canRedo !== this.lastState.canRedo) {
            this.lastState = { ...newState };
            this.onStateChange?.(newState);
        }
    }
}
