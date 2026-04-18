import type { OutputData } from '@editorjs/editorjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSave = vi.fn<() => Promise<OutputData>>();
const mockRender = vi.fn<(data: OutputData) => Promise<void>>();
const mockDestroy = vi.fn<() => void>();
let lastEditorConfig: any = null;

vi.mock('@editorjs/editorjs', () => {
    class MockEditorJS {
        isReady = Promise.resolve();
        save = mockSave;
        render = mockRender;
        destroy = mockDestroy;

        constructor(config: any) {
            lastEditorConfig = config;
            queueMicrotask(() => config.onReady?.());
        }
    }

    return {
        default: MockEditorJS,
    };
});

import { OttaEditor } from '../OttaEditor';

describe('OttaEditor initial undo baseline', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        lastEditorConfig = null;
    });

    it('captures baseline state even without initial data and allows undo to baseline', async () => {
        const initial: OutputData = {
            time: 1,
            blocks: [{ id: 'a', type: 'paragraph', data: { text: '' } }],
            version: '2.30.0',
        };
        const changed: OutputData = {
            time: 2,
            blocks: [{ id: 'b', type: 'paragraph', data: { text: 'Hello' } }],
            version: '2.30.0',
        };

        mockSave.mockResolvedValueOnce(initial).mockResolvedValueOnce(changed);
        mockRender.mockResolvedValue(undefined);

        const holder = document.createElement('div');
        holder.id = 'editor-holder';
        document.body.appendChild(holder);

        const editor = new OttaEditor({
            holder,
        });

        await editor.init();
        await Promise.resolve();

        expect(editor.getUndoRedoState()).toEqual({ canUndo: false, canRedo: false });
        expect(lastEditorConfig).toBeTruthy();

        // Simulate real user interaction before change tracking starts
        holder.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

        await lastEditorConfig.onChange?.({}, {});
        vi.advanceTimersByTime(600);
        await Promise.resolve();

        expect(editor.getUndoRedoState()).toEqual({ canUndo: true, canRedo: false });

        await editor.undo();

        expect(mockRender).toHaveBeenCalledWith(initial);
        expect(editor.getUndoRedoState()).toEqual({ canUndo: false, canRedo: true });

        await editor.destroy();
    });
});
