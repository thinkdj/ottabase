import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { UndoRedoManager } from '../undo-redo';
import type { OutputData } from '@editorjs/editorjs';

function makeData(text: string): OutputData {
    return {
        time: Date.now(),
        blocks: [{ id: '1', type: 'paragraph', data: { text } }],
        version: '2.30.0',
    };
}

describe('UndoRedoManager', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should initialize with default options', () => {
        const manager = new UndoRedoManager();
        const state = manager.getState();
        expect(state.canUndo).toBe(false);
        expect(state.canRedo).toBe(false);
    });

    it('should push initial state immediately', () => {
        const manager = new UndoRedoManager();
        manager.pushStateImmediate(makeData('initial'));
        expect(manager.getState().canUndo).toBe(false);
        expect(manager.getState().canRedo).toBe(false);
    });

    it('should allow undo after two states', () => {
        const manager = new UndoRedoManager();
        manager.pushStateImmediate(makeData('first'));
        manager.pushStateImmediate(makeData('second'));
        expect(manager.getState().canUndo).toBe(true);
        expect(manager.getState().canRedo).toBe(false);
    });

    it('should undo to previous state', () => {
        const manager = new UndoRedoManager();
        manager.pushStateImmediate(makeData('first'));
        manager.pushStateImmediate(makeData('second'));

        const result = manager.undo();
        expect(result).not.toBeNull();
        expect(result!.blocks[0].data.text).toBe('first');
    });

    it('should redo after undo', () => {
        const manager = new UndoRedoManager();
        manager.pushStateImmediate(makeData('first'));
        manager.pushStateImmediate(makeData('second'));

        manager.undo();
        expect(manager.getState().canRedo).toBe(true);

        const result = manager.redo();
        expect(result).not.toBeNull();
        expect(result!.blocks[0].data.text).toBe('second');
    });

    it('should return null when undo is not possible', () => {
        const manager = new UndoRedoManager();
        manager.pushStateImmediate(makeData('only'));
        expect(manager.undo()).toBeNull();
    });

    it('should return null when redo is not possible', () => {
        const manager = new UndoRedoManager();
        manager.pushStateImmediate(makeData('only'));
        expect(manager.redo()).toBeNull();
    });

    it('should truncate forward history when pushing after undo', () => {
        const manager = new UndoRedoManager();
        manager.pushStateImmediate(makeData('first'));
        manager.pushStateImmediate(makeData('second'));
        manager.pushStateImmediate(makeData('third'));

        manager.undo(); // at 'second'
        manager.pushStateImmediate(makeData('new-third'));

        expect(manager.getState().canRedo).toBe(false);
        expect(manager.getState().canUndo).toBe(true);
    });

    it('should debounce pushState calls', () => {
        const manager = new UndoRedoManager({ debounceMs: 100 });
        manager.pushStateImmediate(makeData('initial'));

        // Rapid pushState calls should be debounced
        manager.pushState(makeData('edit-1'));
        manager.pushState(makeData('edit-2'));
        manager.pushState(makeData('edit-3'));

        // Before timer fires, only initial state exists
        expect(manager.getState().canUndo).toBe(false);

        // After timer fires, only the last edit should be recorded
        vi.advanceTimersByTime(200);
        expect(manager.getState().canUndo).toBe(true);

        const result = manager.undo();
        expect(result!.blocks[0].data.text).toBe('initial');
    });

    it('should enforce maxHistory limit', () => {
        const manager = new UndoRedoManager({ maxHistory: 3 });
        manager.pushStateImmediate(makeData('one'));
        manager.pushStateImmediate(makeData('two'));
        manager.pushStateImmediate(makeData('three'));
        manager.pushStateImmediate(makeData('four'));

        // Only 3 entries should remain: two, three, four
        let undoCount = 0;
        while (manager.undo()) undoCount++;
        expect(undoCount).toBe(2); // can undo from 'four' to 'three' to 'two'
    });

    it('should deep-clone data to prevent mutation', () => {
        const manager = new UndoRedoManager();
        const data = makeData('original');
        manager.pushStateImmediate(data);

        // Mutate the original
        data.blocks[0].data.text = 'mutated';

        manager.pushStateImmediate(makeData('second'));
        const result = manager.undo();
        expect(result!.blocks[0].data.text).toBe('original');
    });

    it('should fire onStateChange callback', () => {
        const onChange = vi.fn();
        const manager = new UndoRedoManager({ onStateChange: onChange });

        manager.pushStateImmediate(makeData('first'));
        // First push - state hasn't changed from initial (canUndo: false, canRedo: false)
        // No change expected yet

        manager.pushStateImmediate(makeData('second'));
        // Now canUndo changed to true
        expect(onChange).toHaveBeenCalledWith({ canUndo: true, canRedo: false });

        manager.undo();
        expect(onChange).toHaveBeenCalledWith({ canUndo: false, canRedo: true });
    });

    it('should clear all history', () => {
        const manager = new UndoRedoManager();
        manager.pushStateImmediate(makeData('first'));
        manager.pushStateImmediate(makeData('second'));
        manager.clear();

        expect(manager.getState().canUndo).toBe(false);
        expect(manager.getState().canRedo).toBe(false);
    });

    it('should clean up on destroy', () => {
        const manager = new UndoRedoManager({ debounceMs: 100 });
        manager.pushState(makeData('pending'));
        manager.destroy();

        // Timer should have been cleared - advancing time should not cause issues
        vi.advanceTimersByTime(200);
    });
});
