import type { API, BlockTool } from '@editorjs/editorjs';
import { fileUrl, type FileSource } from '@ottabase/utils/media';
import { toolboxEntry } from '../../blocks';
import {
    field,
    h,
    mediaInput,
    positionToCSS,
    range,
    row,
    segment,
    stack,
    textInput,
    type ImagePosition,
} from '../../ui/kit';
import { BlockShell } from '../../ui/shell';
import { sizingControls } from '../shared/sizing';
import './BeforeAfterTool.css';

export type { ImagePosition };

export interface BeforeAfterData {
    /** The "before" image (left / top): a stored file, or an outside address */
    before?: FileSource;
    /** The "after" image (right / bottom) */
    after?: FileSource;
    /** Optional label shown on the before side (empty = don't render) */
    beforeLabel: string;
    /** Optional label shown on the after side (empty = don't render) */
    afterLabel: string;
    orientation: 'horizontal' | 'vertical';
    /** Initial slider position 0–100 (percentage from left/top) */
    sliderPosition: number;
    caption: string;
    /** Optional fixed height (e.g., '400px', '50vh') */
    height?: string;
    imageFit?: 'contain' | 'cover';
    beforePosition?: ImagePosition;
    afterPosition?: ImagePosition;
}

export interface BeforeAfterToolConfig {
    defaultOrientation?: 'horizontal' | 'vertical';
    defaultPosition?: number;
    /** @deprecated Selections are routed per field now; kept for config compatibility */
    namespace?: string;
    defaultHeight?: string;
    defaultImageFit?: 'contain' | 'cover';
}

const DEFAULT_DATA: BeforeAfterData = {
    beforeLabel: 'Before',
    afterLabel: 'After',
    orientation: 'horizontal',
    sliderPosition: 50,
    caption: '',
    height: '',
    imageFit: 'contain',
    beforePosition: 'center',
    afterPosition: 'center',
};

/**
 * Before/after block. Edit mode: the two images, labels, orientation, start position, caption and
 * sizing, plus a live stage where the divider can be dragged (double-click jumps to the cursor,
 * triple-click cycles 0 → 50 → 100). Preview is the renderer's slider.
 */
export default class BeforeAfterTool implements BlockTool {
    private readonly api: API;
    private readonly config: BeforeAfterToolConfig;
    private data: BeforeAfterData;
    private shell: BlockShell | null = null;
    private stage: HTMLElement | null = null;
    private stageHost: HTMLElement | null = null;
    private positionRange: HTMLInputElement | null = null;
    private positionLabel: HTMLElement | null = null;
    private cleanups: Array<() => void> = [];

    static get toolbox() {
        return toolboxEntry('beforeAfter');
    }

    constructor({
        data,
        api,
        config,
    }: {
        data?: Partial<BeforeAfterData>;
        api: API;
        config?: BeforeAfterToolConfig;
        block?: unknown;
    }) {
        this.api = api;
        this.config = config || {};
        const d = data ?? {};
        this.data = {
            ...DEFAULT_DATA,
            ...d,
            orientation: d.orientation ?? this.config.defaultOrientation ?? DEFAULT_DATA.orientation,
            sliderPosition: d.sliderPosition ?? this.config.defaultPosition ?? DEFAULT_DATA.sliderPosition,
            height: d.height ?? this.config.defaultHeight ?? DEFAULT_DATA.height,
            imageFit: d.imageFit ?? this.config.defaultImageFit ?? DEFAULT_DATA.imageFit,
        };
    }

    render(): HTMLElement {
        const shell = new BlockShell({
            type: 'beforeAfter',
            hasContent: Boolean(this.data.before && this.data.after),
            summary: this.summary(),
        });
        this.shell = shell;

        const before = mediaInput({
            value: this.data.before,
            ariaLabel: 'Before image',
            onChange: (value) => this.set({ before: value }),
        });
        const after = mediaInput({
            value: this.data.after,
            ariaLabel: 'After image',
            onChange: (value) => this.set({ after: value }),
        });
        this.cleanups.push(before.destroy, after.destroy);

        const beforeLabel = textInput({
            value: this.data.beforeLabel,
            placeholder: 'Empty hides the label',
            onInput: (v) => this.set({ beforeLabel: v }),
        });
        const afterLabel = textInput({
            value: this.data.afterLabel,
            placeholder: 'Empty hides the label',
            onInput: (v) => this.set({ afterLabel: v }),
        });
        const orientation = segment<'horizontal' | 'vertical'>({
            value: this.data.orientation,
            ariaLabel: 'Orientation',
            options: [
                { value: 'horizontal', icon: 'horizontal', label: 'Horizontal' },
                { value: 'vertical', icon: 'vertical', label: 'Vertical' },
            ],
            onChange: (v) => this.set({ orientation: v }),
        });
        this.positionRange = range({
            value: this.data.sliderPosition,
            min: 0,
            max: 100,
            ariaLabel: 'Start position',
            onInput: (v) => this.set({ sliderPosition: v }),
        });
        this.positionLabel = h('span', { className: 'oe-hint oe-compare__pos' }, `${this.data.sliderPosition}%`);
        const caption = textInput({
            value: this.data.caption,
            placeholder: 'Optional caption',
            onInput: (v) => this.set({ caption: v }),
        });

        const sizing = sizingControls(
            this.data,
            [
                { key: 'beforePosition', label: 'Before focus' },
                { key: 'afterPosition', label: 'After focus' },
            ],
            () => this.set({}),
        );

        this.stageHost = h('div', { className: 'oe-compare' });
        shell.fields.append(
            stack(
                row(
                    field({ label: 'Before', control: before.element, grow: true }),
                    field({ label: 'After', control: after.element, grow: true }),
                ),
                row(
                    field({ label: 'Before label', control: beforeLabel }),
                    field({ label: 'After label', control: afterLabel }),
                ),
                row(
                    field({ label: 'Orientation', control: orientation }),
                    field({
                        label: 'Start position',
                        control: h('div', { className: 'oe-compare__range' }, this.positionRange, this.positionLabel),
                        grow: true,
                    }),
                ),
                field({ label: 'Caption', control: caption }),
                sizing,
                this.stageHost,
            ),
        );
        this.buildStage();
        shell.preview({ ...this.data });
        return shell.element;
    }

    private set(patch: Partial<BeforeAfterData>) {
        Object.assign(this.data, patch);
        this.shell?.setSummary(this.summary());
        this.shell?.preview({ ...this.data });
        this.buildStage();
    }

    private summary() {
        const sides = [this.data.before, this.data.after].filter(Boolean).length;
        return sides === 2 ? `${this.data.orientation} · ${this.data.sliderPosition}%` : `${sides} of 2 images`;
    }

    /* ── Stage: the live comparison the author drags ───────────────────────── */

    private buildStage() {
        if (!this.stageHost) return;
        this.stageHost.innerHTML = '';
        this.stage = null;
        if (!this.data.before && !this.data.after) return;

        const vertical = this.data.orientation === 'vertical';
        const cover = this.data.imageFit === 'cover';
        const stage = h('div', {
            className: `oe-compare__stage${vertical ? ' oe-compare__stage--vertical' : ''}${cover ? ' oe-compare__stage--cover' : ''}`,
            role: 'slider',
            'aria-label': 'Comparison divider',
            'aria-valuemin': '0',
            'aria-valuemax': '100',
            'aria-valuenow': String(this.data.sliderPosition),
            tabIndex: 0,
            title: 'Drag the divider. Double-click to jump, triple-click to cycle.',
        });
        if (this.data.height) stage.style.height = this.data.height;
        else if (cover) stage.style.height = '300px';

        // The stage spans the block: the full rendition, never the unoptimised original
        if (this.data.after) {
            const img = h('img', {
                className: 'oe-compare__after',
                src: fileUrl(this.data.after, 'full'),
                alt: this.data.afterLabel || 'After',
                draggable: false,
            });
            if (cover) img.style.objectPosition = positionToCSS(this.data.afterPosition);
            stage.append(img);
        }
        if (this.data.before) {
            const img = h('img', {
                src: fileUrl(this.data.before, 'full'),
                alt: this.data.beforeLabel || 'Before',
                draggable: false,
            });
            if (cover) img.style.objectPosition = positionToCSS(this.data.beforePosition);
            stage.append(h('div', { className: 'oe-compare__before' }, img));
        }
        if (this.data.beforeLabel)
            stage.append(
                h('span', { className: 'oe-compare__label oe-compare__label--before' }, this.data.beforeLabel),
            );
        if (this.data.afterLabel)
            stage.append(h('span', { className: 'oe-compare__label oe-compare__label--after' }, this.data.afterLabel));
        stage.append(h('div', { className: 'oe-compare__handle' }));

        let dragging = false;
        const pct = (e: PointerEvent) => {
            const r = stage.getBoundingClientRect();
            const raw = vertical ? ((e.clientY - r.top) / r.height) * 100 : ((e.clientX - r.left) / r.width) * 100;
            return Math.max(0, Math.min(100, Math.round(raw)));
        };
        stage.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            dragging = true;
            stage.setPointerCapture?.(e.pointerId);
            this.setPosition(pct(e));
        });
        stage.addEventListener('pointermove', (e) => dragging && this.setPosition(pct(e)));
        const end = () => {
            dragging = false;
        };
        stage.addEventListener('pointerup', end);
        stage.addEventListener('pointercancel', end);
        // detail counts clicks: 2 = jump to the cursor, 3 = cycle 0 → 50 → 100
        stage.addEventListener('click', (e) => {
            if (e.detail === 3) {
                const p = this.data.sliderPosition;
                this.setPosition(p < 25 ? 50 : p < 75 ? 100 : 0);
            }
        });
        stage.addEventListener('keydown', (e) => {
            const step = e.shiftKey ? 10 : 1;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') this.setPosition(this.data.sliderPosition - step);
            else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.setPosition(this.data.sliderPosition + step);
            else return;
            e.preventDefault();
        });

        this.stage = stage;
        this.paintPosition();
        this.stageHost.append(stage);
    }

    /** Slider moved on the stage: update data and every mirror without rebuilding. */
    private setPosition(p: number) {
        this.data.sliderPosition = Math.max(0, Math.min(100, Math.round(p)));
        this.paintPosition();
        if (this.positionRange) this.positionRange.value = String(this.data.sliderPosition);
        if (this.positionLabel) this.positionLabel.textContent = `${this.data.sliderPosition}%`;
        this.shell?.setSummary(this.summary());
        this.shell?.preview({ ...this.data });
    }

    private paintPosition() {
        if (!this.stage) return;
        const p = this.data.sliderPosition;
        const vertical = this.data.orientation === 'vertical';
        this.stage.style.setProperty('--oe-compare-pos', `${p}%`);
        this.stage.setAttribute('aria-valuenow', String(p));
        const before = this.stage.querySelector<HTMLElement>('.oe-compare__before');
        if (before) before.style.clipPath = vertical ? `inset(0 0 ${100 - p}% 0)` : `inset(0 ${100 - p}% 0 0)`;
    }

    save(): BeforeAfterData {
        return { ...this.data };
    }

    validate(savedData: BeforeAfterData): boolean {
        return !!(savedData.before || savedData.after);
    }

    destroy(): void {
        this.cleanups.splice(0).forEach((fn) => fn());
        this.shell?.destroy();
        this.shell = null;
        this.stage = null;
    }
}
