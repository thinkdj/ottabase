/**
 * The block shell: the frame every custom block lives in.
 *
 *   ┌ oe-block ─────────────────────────────────────────────────────────┐
 *   │ [icon] Title · summary                        [ Edit | Preview ]  │  header
 *   │ fields (edit mode)   or   the block as it will publish (preview)  │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * Preview is the real thing: the shell mounts `@ottabase/ottarenderer`'s renderer for the block's
 * own data, so what the author sees is exactly what the reader gets, with zero styling drift.
 * A filled block opens in preview; an empty one opens in edit. Clicking a preview enters edit.
 */
import { OttaRenderer } from '@ottabase/ottarenderer';
import { createRoot, type Root } from 'react-dom/client';
import { blockMeta } from '../blocks';
import { h, iconEl, segment } from './kit';

export type ShellMode = 'edit' | 'preview';

export interface BlockShellOptions {
    /** Editor.js block type; also the renderer key used for the preview */
    type: string;
    /** Start mode. Default: preview when `hasContent`, else edit. */
    mode?: ShellMode;
    hasContent?: boolean;
    /** Short status text after the title ("3 steps", "16:9") */
    summary?: string;
    /** When false the header has no mode switch and the fields are always shown (blocks with no renderer). */
    previewable?: boolean;
    onModeChange?: (mode: ShellMode) => void;
}

export class BlockShell {
    readonly element: HTMLElement;
    /** Append fields here */
    readonly fields: HTMLElement;
    private readonly previewEl: HTMLElement;
    private readonly summaryEl: HTMLElement;
    private readonly type: string;
    private root: Root | null = null;
    private mode: ShellMode;
    private lastData: object | null = null;
    private frame: number | null = null;
    private readonly onModeChange?: (mode: ShellMode) => void;

    constructor(opts: BlockShellOptions) {
        const meta = blockMeta(opts.type);
        this.type = opts.type;
        this.onModeChange = opts.onModeChange;
        const previewable = opts.previewable ?? true;
        this.mode = opts.mode ?? (previewable && opts.hasContent ? 'preview' : 'edit');

        this.summaryEl = h('span', { className: 'oe-block__summary' }, opts.summary ?? '');
        const title = h(
            'div',
            { className: 'oe-block__title' },
            meta ? iconEl(meta.icon) : null,
            h('span', { className: 'oe-block__name' }, meta?.title ?? opts.type),
            this.summaryEl,
        );
        const modes = previewable
            ? segment<ShellMode>({
                  value: this.mode,
                  ariaLabel: 'Block view',
                  options: [
                      { value: 'edit', icon: 'pencil', label: 'Edit' },
                      { value: 'preview', icon: 'eye', label: 'Preview' },
                  ],
                  onChange: (m) => this.setMode(m, false),
              })
            : null;
        this.modesEl = modes;
        const header = h('div', { className: 'oe-block__header' }, title, modes);

        this.fields = h('div', { className: 'oe-block__fields' });
        this.previewEl = h('div', { className: 'oe-block__preview', title: 'Click to edit' });
        this.previewEl.addEventListener('click', (e) => {
            // Links inside a preview must not navigate away from the editor
            if ((e.target as HTMLElement).closest('a')) e.preventDefault();
            this.setMode('edit');
        });

        this.element = h(
            'div',
            { className: 'oe-block', dataset: { block: opts.type, mode: this.mode } },
            header,
            this.fields,
            this.previewEl,
        );
    }

    private modesEl: HTMLElement | null;

    get currentMode() {
        return this.mode;
    }

    /** Switch between editing and the published look. */
    setMode(mode: ShellMode, syncSwitch = true) {
        if (this.mode === mode) return;
        this.mode = mode;
        this.element.dataset.mode = mode;
        if (syncSwitch && this.modesEl) {
            this.modesEl.querySelectorAll<HTMLButtonElement>('[role=radio]').forEach((b, i) => {
                const on = (i === 0 ? 'edit' : 'preview') === mode;
                b.setAttribute('aria-checked', String(on));
                b.tabIndex = on ? 0 : -1;
            });
        }
        if (mode === 'preview' && this.lastData) this.mount(this.lastData);
        if (mode === 'edit')
            (this.fields.querySelector('input, textarea, select, button') as HTMLElement | null)?.focus?.();
        this.onModeChange?.(mode);
    }

    setSummary(text: string) {
        this.summaryEl.textContent = text;
    }

    /**
     * Render the block's current data as the reader will see it. Cheap to call on every keystroke:
     * it is coalesced to one render per frame and skipped while the block is in edit mode.
     */
    preview<T extends object>(data: T) {
        this.lastData = data;
        if (this.mode !== 'preview') return;
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            this.mount(data);
        });
    }

    private mount(data: object) {
        if (!this.root) this.root = createRoot(this.previewEl);
        this.root.render(
            <OttaRenderer data={{ blocks: [{ id: 'preview', type: this.type, data }] }} className="oe-block__render" />,
        );
    }

    destroy() {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        const root = this.root;
        this.root = null;
        // Unmount outside the current render pass; Editor.js may be mid-removal of the block
        if (root) setTimeout(() => root.unmount(), 0);
    }
}
