/**
 * Vanilla image cropper, fixed-viewfinder model: the frame fills the stage, the photo pans,
 * pinches, zooms, rotates and flips underneath it. The photo is a CSS-transformed <img>, the
 * overlay is DOM, so every pixel is themeable and crisp on any display; canvas is used only to
 * export. Zero dependencies.
 */
import type { Handle, Point, Rect, View } from './geometry';
import {
    center,
    clampView,
    coverScale,
    covers,
    fitRect,
    flip,
    HANDLES,
    refit,
    resizeRect,
    rotateAbout,
    toImage,
    zoomAbout,
} from './geometry';
import type { AspectPreset, CropperOptions, CropperState, CropShape } from './types';
import { DEFAULT_ASPECT_PRESETS } from './types';

const PADDING = 20;
const MIN_FRAME = 48;
const GRID_LINGER_MS = 450;

const svg = (body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON = {
    image: svg(
        '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    ),
    replace: svg(
        '<path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21"/><path d="m14 19.5 3-3 3 3"/><path d="M17 22v-5.5"/><circle cx="9" cy="9" r="2"/>',
    ),
    zoomIn: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/>'),
    zoomOut: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6"/>'),
    rotateCcw: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
    rotateCw: svg('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'),
    flipH: svg(
        '<path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M12 20v2"/><path d="M12 14v2"/><path d="M12 8v2"/><path d="M12 2v2"/>',
    ),
    flipV: svg(
        '<path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/><path d="M4 12H2"/><path d="M10 12H8"/><path d="M16 12h-2"/><path d="M22 12h-2"/>',
    ),
    reset: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>'),
};

type Gesture =
    | { kind: 'pan'; view0: View; p0: Point }
    | { kind: 'pinch'; view0: View; mid0: Point; dist0: number }
    | { kind: 'resize'; handle: Handle; frame0: Rect; p0: Point };

const CURSORS: Record<Handle, string> = {
    nw: 'nwse-resize',
    se: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize',
};

export class Cropper {
    private readonly root: HTMLElement;
    private readonly options: Required<
        Omit<CropperOptions, 'aspectRatio' | 'aspectPresets' | 'onImageLoad' | 'onChange' | 'onError' | 'maxOutput'>
    > &
        Pick<CropperOptions, 'onImageLoad' | 'onChange' | 'onError' | 'maxOutput'> & {
            aspectPresets: AspectPreset[] | false;
        };

    // DOM
    private fileInput!: HTMLInputElement;
    private stage!: HTMLDivElement;
    private imageEl!: HTMLImageElement;
    private frameEl!: HTMLDivElement;
    private emptyEl!: HTMLButtonElement;
    private emptyHint!: HTMLSpanElement;
    private zoomRange!: HTMLInputElement;
    private straightenRange: HTMLInputElement | null = null;
    private straightenLabel: HTMLSpanElement | null = null;
    private flipHBtn!: HTMLButtonElement;
    private flipVBtn!: HTMLButtonElement;
    private resetBtn!: HTMLButtonElement;
    private replaceBtn!: HTMLButtonElement;
    private presetBtns = new Map<number | null, HTMLButtonElement>();
    private needsImage: Array<HTMLButtonElement | HTMLInputElement> = [];

    // Model
    private img: HTMLImageElement | null = null;
    private imageUrl: string | null = null;
    private ownsUrl = false;
    private loadToken = 0;
    /** Aspect the consumer asked for; Reset returns to it */
    private baseAspect: number | null;
    /** Aspect currently locked by a preset, or null while the frame is free */
    private aspect: number | null;
    private shape: CropShape;
    private frame: Rect = { x: 0, y: 0, w: 0, h: 0 };
    private view: View = { cx: 0, cy: 0, scale: 1, rotation: 0, flipX: false, flipY: false };
    /** Fine rotation in screen degrees, -45..45 */
    private fine = 0;
    /** Quarter turns the user asked for, unbounded; reported mod 4 whatever the flips did to the geometry */
    private turns = 0;

    // Interaction
    private pointers = new Map<number, Point>();
    private gesture: Gesture | null = null;
    private dragDepth = 0;
    private gridTimer: ReturnType<typeof setTimeout> | null = null;
    private animTimer: ReturnType<typeof setTimeout> | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private destroyed = false;

    constructor(container: HTMLElement, options: CropperOptions = {}) {
        this.root = container;
        this.options = {
            shape: options.shape ?? 'rect',
            aspectPresets: options.aspectPresets ?? DEFAULT_ASPECT_PRESETS,
            accept: options.accept ?? 'image/*',
            height: options.height ?? 360,
            maxZoom: Math.max(1, options.maxZoom ?? 4),
            maxOutput: options.maxOutput ?? 4096,
            straighten: options.straighten ?? false,
            transitions: options.transitions ?? true,
            transitionDuration: options.transitionDuration ?? 240,
            onImageLoad: options.onImageLoad,
            onChange: options.onChange,
            onError: options.onError,
        };
        this.baseAspect = options.aspectRatio === undefined ? 1 : options.aspectRatio;
        this.aspect = this.baseAspect;
        this.shape = this.options.shape;
        this.mount();
    }

    // ─────────────────────────────────────────────────────────────── DOM

    private mount() {
        const root = this.root;
        root.innerHTML = '';
        root.classList.add('ottacropper', 'ottacropper--empty');
        root.dataset.slot = 'cropper';
        root.tabIndex = 0;
        root.setAttribute('role', 'group');
        root.setAttribute('aria-label', 'Image cropper');
        root.style.setProperty('--cr-duration', `${this.options.transitionDuration}ms`);

        this.fileInput = el('input', 'ottacropper-file');
        this.fileInput.type = 'file';
        this.fileInput.accept = this.options.accept;
        this.fileInput.tabIndex = -1;
        this.fileInput.setAttribute('aria-hidden', 'true');
        this.fileInput.onchange = () => this.loadFromFile(this.fileInput.files?.[0]);

        // Stage: photo, frame, empty state
        this.stage = el('div', 'ottacropper-stage');
        this.stage.dataset.slot = 'cropper-stage';
        this.stage.style.height = `${this.options.height}px`;

        this.imageEl = el('img', 'ottacropper-image');
        this.imageEl.alt = '';
        this.imageEl.draggable = false;
        this.imageEl.hidden = true;

        this.frameEl = el('div', 'ottacropper-frame');
        this.frameEl.dataset.slot = 'cropper-frame';
        this.frameEl.hidden = true;
        this.frameEl.appendChild(el('div', 'ottacropper-grid'));
        for (const h of HANDLES) {
            const handle = el('div', 'ottacropper-handle');
            handle.dataset.handle = h;
            handle.style.cursor = CURSORS[h];
            this.frameEl.appendChild(handle);
        }

        this.emptyEl = el('button', 'ottacropper-empty');
        this.emptyEl.type = 'button';
        this.emptyEl.dataset.slot = 'cropper-empty';
        this.emptyHint = el('span', 'ottacropper-empty-hint');
        this.emptyEl.innerHTML = `${ICON.image}<strong>Drop a photo here</strong>`;
        this.emptyEl.appendChild(this.emptyHint);
        this.emptyEl.onclick = () => this.openFilePicker();
        this.setEmptyHint();

        this.stage.append(this.imageEl, this.frameEl, this.emptyEl);

        // Toolbar
        const toolbar = el('div', 'ottacropper-toolbar');
        toolbar.dataset.slot = 'cropper-toolbar';
        toolbar.setAttribute('role', 'toolbar');
        toolbar.setAttribute('aria-label', 'Crop tools');

        if (this.options.aspectPresets && this.options.aspectPresets.length > 0) {
            const presets = el('div', 'ottacropper-presets');
            presets.setAttribute('role', 'radiogroup');
            presets.setAttribute('aria-label', 'Aspect ratio');
            for (const { label, value } of this.options.aspectPresets) {
                const b = el('button', 'ottacropper-preset');
                b.type = 'button';
                b.textContent = label;
                b.setAttribute('role', 'radio');
                b.setAttribute('aria-checked', 'false');
                b.onclick = () => this.animate(() => this.applyAspect(value));
                presets.appendChild(b);
                this.presetBtns.set(value, b);
                this.needsImage.push(b);
            }
            toolbar.appendChild(presets);
        }

        const zoom = el('div', 'ottacropper-zoom');
        zoom.setAttribute('role', 'group');
        zoom.setAttribute('aria-label', 'Zoom');
        this.iconBtn(zoom, ICON.zoomOut, 'Zoom out', () => this.zoomOut());
        this.zoomRange = el('input', 'ottacropper-range');
        this.zoomRange.type = 'range';
        this.zoomRange.min = '1';
        this.zoomRange.max = String(this.options.maxZoom);
        this.zoomRange.step = '0.01';
        this.zoomRange.value = '1';
        this.zoomRange.setAttribute('aria-label', 'Zoom');
        this.zoomRange.oninput = () => {
            this.touchGrid();
            this.setZoom(Number(this.zoomRange.value), false);
        };
        zoom.appendChild(this.zoomRange);
        this.needsImage.push(this.zoomRange);
        this.iconBtn(zoom, ICON.zoomIn, 'Zoom in', () => this.zoomIn());
        toolbar.appendChild(zoom);

        if (this.options.straighten) {
            const wrap = el('div', 'ottacropper-straighten');
            wrap.setAttribute('role', 'group');
            wrap.setAttribute('aria-label', 'Straighten');
            this.straightenRange = el('input', 'ottacropper-range');
            this.straightenRange.type = 'range';
            this.straightenRange.min = '-45';
            this.straightenRange.max = '45';
            this.straightenRange.step = '0.5';
            this.straightenRange.value = '0';
            this.straightenRange.setAttribute('aria-label', 'Straighten');
            this.straightenRange.oninput = () => {
                this.touchGrid();
                this.setStraighten(Number(this.straightenRange!.value), false);
            };
            this.straightenRange.ondblclick = () => this.setStraighten(0);
            this.straightenLabel = el('span', 'ottacropper-degrees');
            this.straightenLabel.textContent = '0°';
            wrap.append(this.straightenRange, this.straightenLabel);
            this.needsImage.push(this.straightenRange);
            toolbar.appendChild(wrap);
        }

        const transforms = el('div', 'ottacropper-group');
        transforms.setAttribute('role', 'group');
        transforms.setAttribute('aria-label', 'Rotate and flip');
        this.iconBtn(transforms, ICON.rotateCcw, 'Rotate left', () => this.rotate(-90));
        this.iconBtn(transforms, ICON.rotateCw, 'Rotate right', () => this.rotate(90));
        this.flipHBtn = this.iconBtn(transforms, ICON.flipH, 'Flip horizontal', () => this.flipHorizontal(), true);
        this.flipVBtn = this.iconBtn(transforms, ICON.flipV, 'Flip vertical', () => this.flipVertical(), true);
        toolbar.appendChild(transforms);

        const actions = el('div', 'ottacropper-actions');
        this.resetBtn = this.iconBtn(actions, ICON.reset, 'Reset', () => this.reset());
        this.resetBtn.hidden = true;
        this.replaceBtn = el('button', 'ottacropper-btn ottacropper-btn--text');
        this.replaceBtn.type = 'button';
        this.replaceBtn.innerHTML = `${ICON.replace}<span>Replace</span>`;
        this.replaceBtn.title = 'Replace photo';
        this.replaceBtn.setAttribute('aria-label', 'Replace photo');
        this.replaceBtn.onclick = () => this.openFilePicker();
        this.replaceBtn.hidden = true;
        actions.appendChild(this.replaceBtn);
        toolbar.appendChild(actions);

        root.append(this.fileInput, this.stage, toolbar);
        for (const c of this.needsImage) c.disabled = true;

        this.stage.addEventListener('pointerdown', this.onPointerDown);
        this.stage.addEventListener('pointermove', this.onPointerMove);
        this.stage.addEventListener('pointerup', this.onPointerUp);
        this.stage.addEventListener('pointercancel', this.onPointerUp);
        this.stage.addEventListener('wheel', this.onWheel, { passive: false });
        this.stage.addEventListener('dblclick', this.onDblClick);
        root.addEventListener('keydown', this.onKeyDown);
        root.addEventListener('dragenter', this.onDragEnter);
        root.addEventListener('dragover', this.onDragOver);
        root.addEventListener('dragleave', this.onDragLeave);
        root.addEventListener('drop', this.onDrop);
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => this.onStageResize());
            this.resizeObserver.observe(this.stage);
        }
        this.applyShape();
        this.syncToolbar();
    }

    private iconBtn(parent: HTMLElement, icon: string, label: string, fn: () => void, toggle = false) {
        const b = el('button', 'ottacropper-btn');
        b.type = 'button';
        b.title = label;
        b.setAttribute('aria-label', label);
        if (toggle) b.setAttribute('aria-pressed', 'false');
        b.innerHTML = icon;
        b.onclick = fn;
        parent.appendChild(b);
        this.needsImage.push(b);
        return b;
    }

    private openFilePicker() {
        this.fileInput.value = '';
        this.fileInput.click();
    }

    private setEmptyHint(text = 'or click to browse', error = false) {
        this.emptyHint.textContent = text;
        this.emptyEl.classList.toggle('ottacropper-empty--error', error);
    }

    private fail(message: string) {
        if (!this.img) this.setEmptyHint(message, true);
        this.options.onError?.(message);
    }

    // ─────────────────────────────────────────────────────────────── Loading

    /** Load a photo from a File (file picker, drop, or your own input). */
    loadFromFile(file: File | undefined | null) {
        if (!file) return;
        const looksLikeImage = file.type
            ? file.type.startsWith('image/')
            : /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(file.name);
        if (!looksLikeImage) {
            this.fail("That file isn't an image");
            return;
        }
        this.load(URL.createObjectURL(file), true);
    }

    /** Load a photo from a URL (http(s), blob: or data:). Remote hosts must allow CORS for export to work. */
    loadFromUrl(url: string) {
        if (!url) return;
        this.load(url, false);
    }

    private load(src: string, owned: boolean) {
        const token = ++this.loadToken;
        const img = new Image();
        if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (token !== this.loadToken || this.destroyed) {
                if (owned) URL.revokeObjectURL(src);
                return;
            }
            if (this.ownsUrl && this.imageUrl) URL.revokeObjectURL(this.imageUrl);
            this.img = img;
            this.imageUrl = src;
            this.ownsUrl = owned;
            this.imageEl.src = src;
            this.imageEl.width = img.naturalWidth;
            this.imageEl.height = img.naturalHeight;
            this.imageEl.style.width = `${img.naturalWidth}px`;
            this.imageEl.style.height = `${img.naturalHeight}px`;
            this.imageEl.hidden = false;
            this.frameEl.hidden = false;
            this.emptyEl.hidden = true;
            this.replaceBtn.hidden = false;
            this.root.classList.remove('ottacropper--empty');
            for (const c of this.needsImage) c.disabled = false;
            this.setEmptyHint();
            this.root.classList.remove('ottacropper--animate');
            this.home();
            this.apply();
            this.options.onImageLoad?.(this.getState());
        };
        img.onerror = () => {
            if (owned) URL.revokeObjectURL(src);
            if (token !== this.loadToken || this.destroyed) return;
            this.fail("Couldn't open that image");
        };
        img.src = src;
    }

    /** True once a photo is on the stage. */
    hasImage(): boolean {
        return this.img !== null;
    }

    // ─────────────────────────────────────────────────────────────── Geometry

    private stageRect(): Rect {
        return { x: 0, y: 0, w: this.stage.clientWidth || 320, h: this.stage.clientHeight || this.options.height };
    }

    private contentRect(): Rect {
        const s = this.stageRect();
        return {
            x: PADDING,
            y: PADDING,
            w: Math.max(MIN_FRAME, s.w - 2 * PADDING),
            h: Math.max(MIN_FRAME, s.h - 2 * PADDING),
        };
    }

    private imageAspect(): number {
        if (!this.img) return 1;
        return Math.min(5, Math.max(0.2, this.img.naturalWidth / this.img.naturalHeight));
    }

    /** Frame for an aspect; a free frame keeps its current proportions (or the photo's, on first load). */
    private frameFor(aspect: number | null): Rect {
        const ratio = aspect ?? (this.frame.w > 0 ? this.frame.w / this.frame.h : this.imageAspect());
        return fitRect(this.contentRect(), ratio);
    }

    private homeView(frame: Rect): View {
        const fc = center(frame);
        const iw = this.img?.naturalWidth ?? 1;
        const ih = this.img?.naturalHeight ?? 1;
        return {
            cx: fc.x,
            cy: fc.y,
            scale: coverScale(iw, ih, frame.w, frame.h, 0),
            rotation: 0,
            flipX: false,
            flipY: false,
        };
    }

    private homeFrame(): Rect {
        return fitRect(this.contentRect(), this.baseAspect ?? this.imageAspect());
    }

    /** Back to the freshly loaded photo: base aspect, cover zoom, centred, no rotation or flips. */
    private home() {
        this.aspect = this.baseAspect;
        this.fine = 0;
        this.turns = 0;
        this.frame = this.homeFrame();
        this.view = this.homeView(this.frame);
    }

    private minScale(): number {
        if (!this.img) return 1;
        return coverScale(
            this.img.naturalWidth,
            this.img.naturalHeight,
            this.frame.w,
            this.frame.h,
            this.view.rotation,
        );
    }

    private clamp(view: View): View {
        if (!this.img) return view;
        const min = this.minScale();
        const max = min * this.options.maxZoom;
        return clampView(
            { ...view, scale: Math.min(max, Math.max(min, view.scale)) },
            this.frame,
            this.img.naturalWidth,
            this.img.naturalHeight,
        );
    }

    /** Sign relating local rotation to what the viewer sees: a single flip mirrors the direction. */
    private sign(): number {
        return this.view.flipX !== this.view.flipY ? -1 : 1;
    }

    private screenAngle(): number {
        return this.sign() * this.view.rotation;
    }

    private quarterTurns(): number {
        return (((this.turns * 90) % 360) + 360) % 360;
    }

    // ─────────────────────────────────────────────────────────────── Rendering

    private apply() {
        if (this.destroyed) return;
        const f = this.frame;
        this.frameEl.style.left = `${f.x}px`;
        this.frameEl.style.top = `${f.y}px`;
        this.frameEl.style.width = `${f.w}px`;
        this.frameEl.style.height = `${f.h}px`;
        if (this.img) {
            const v = this.view;
            const sx = v.scale * (v.flipX ? -1 : 1);
            const sy = v.scale * (v.flipY ? -1 : 1);
            this.imageEl.style.transform = `translate(${v.cx}px, ${v.cy}px) scale(${sx}, ${sy}) rotate(${v.rotation}deg) translate(${-this.img.naturalWidth / 2}px, ${-this.img.naturalHeight / 2}px)`;
        }
        this.root.classList.toggle('ottacropper--free', this.aspect === null);
        this.syncToolbar();
        this.options.onChange?.(this.getState());
    }

    private applyShape() {
        this.root.classList.toggle('ottacropper--circle', this.shape === 'circle');
    }

    private syncToolbar() {
        const state = this.getState();
        this.zoomRange.value = String(state.zoom);
        if (this.straightenRange) this.straightenRange.value = String(this.fine);
        if (this.straightenLabel) this.straightenLabel.textContent = `${this.fine}°`;
        this.flipHBtn.setAttribute('aria-pressed', String(this.view.flipX));
        this.flipVBtn.setAttribute('aria-pressed', String(this.view.flipY));
        this.flipHBtn.classList.toggle('ottacropper-btn--on', this.view.flipX);
        this.flipVBtn.classList.toggle('ottacropper-btn--on', this.view.flipY);
        this.resetBtn.hidden = !state.dirty;
        for (const [value, btn] of this.presetBtns) {
            const on =
                value === null ? this.aspect === null : this.aspect !== null && Math.abs(value - this.aspect) < 1e-6;
            btn.setAttribute('aria-checked', String(on));
            btn.classList.toggle('ottacropper-preset--on', on);
        }
    }

    /** Run a discrete change with CSS transitions on; pointer gestures never go through here. */
    private animate(fn: () => void) {
        const motion = this.options.transitions && !matchMediaReduced();
        if (motion) this.root.classList.add('ottacropper--animate');
        fn();
        this.apply();
        if (this.animTimer) clearTimeout(this.animTimer);
        if (motion) {
            this.animTimer = setTimeout(
                () => this.root.classList.remove('ottacropper--animate'),
                this.options.transitionDuration + 30,
            );
        }
    }

    /** Show the composition grid for a moment after a slider or wheel change. */
    private touchGrid() {
        this.root.classList.add('ottacropper--interacting');
        if (this.gridTimer) clearTimeout(this.gridTimer);
        this.gridTimer = setTimeout(() => this.root.classList.remove('ottacropper--interacting'), GRID_LINGER_MS);
    }

    // ─────────────────────────────────────────────────────────────── Public transforms

    getState(): CropperState {
        const min = this.minScale();
        const homeFrame = this.img ? this.homeFrame() : this.frame;
        const home = this.img ? this.homeView(homeFrame) : this.view;
        const v = this.view;
        const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
        const dirty =
            !!this.img &&
            (v.scale / min > 1.001 ||
                v.flipX ||
                v.flipY ||
                this.quarterTurns() !== 0 ||
                this.fine !== 0 ||
                !near(v.cx, home.cx) ||
                !near(v.cy, home.cy) ||
                !near(this.frame.w, homeFrame.w) ||
                !near(this.frame.h, homeFrame.h));
        return {
            hasImage: !!this.img,
            zoom: this.img ? Math.round((v.scale / min) * 1000) / 1000 : 1,
            rotation: this.quarterTurns(),
            straighten: this.fine,
            flipX: v.flipX,
            flipY: v.flipY,
            aspectRatio: this.frame.h > 0 ? this.frame.w / this.frame.h : (this.aspect ?? 1),
            output: this.img
                ? { width: Math.round(this.frame.w / v.scale), height: Math.round(this.frame.h / v.scale) }
                : { width: 0, height: 0 },
            dirty,
        };
    }

    getZoom(): number {
        return this.getState().zoom;
    }

    /** Zoom relative to cover (1 = photo exactly fills the frame), about the frame centre. */
    setZoom(zoom: number, animated = true) {
        if (!this.img) return;
        const scale = this.minScale() * Math.min(this.options.maxZoom, Math.max(1, zoom));
        const run = () => {
            this.view = this.clamp(zoomAbout(this.view, scale, center(this.frame)));
        };
        if (animated) this.animate(run);
        else {
            run();
            this.apply();
        }
    }

    zoomIn() {
        this.setZoom(this.getZoom() * 1.25);
    }

    zoomOut() {
        this.setZoom(this.getZoom() / 1.25);
    }

    /** Rotate about the frame centre; positive is clockwise on screen. A free frame turns with the photo. */
    rotate(deg = 90) {
        if (!this.img) return;
        this.animate(() => {
            this.turns += Math.round(deg / 90);
            this.view = rotateAbout(this.view, this.frame, deg);
            if (this.aspect === null && Math.abs(deg) % 180 === 90) {
                // The framed content is now h wide and w tall; grow that region back to fill the stage.
                const fc = center(this.frame);
                const turned = {
                    x: fc.x - this.frame.h / 2,
                    y: fc.y - this.frame.w / 2,
                    w: this.frame.h,
                    h: this.frame.w,
                };
                const next = fitRect(this.contentRect(), turned.w / turned.h);
                this.view = refit(this.view, turned, next);
                this.frame = next;
            }
            this.view = this.clamp(this.view);
        });
    }

    /** Fine rotation in degrees, -45..45. */
    setStraighten(deg: number, animated = true) {
        if (!this.img) return;
        const next = Math.max(-45, Math.min(45, deg));
        const run = () => {
            const quarter = this.screenAngle() - this.fine;
            this.fine = next;
            this.view = this.clamp({ ...this.view, rotation: this.sign() * (quarter + next) });
        };
        if (animated) this.animate(run);
        else {
            run();
            this.apply();
        }
    }

    flipHorizontal() {
        if (!this.img) return;
        this.animate(() => {
            this.view = this.clamp(flip(this.view, this.frame, 'x'));
        });
    }

    flipVertical() {
        if (!this.img) return;
        this.animate(() => {
            this.view = this.clamp(flip(this.view, this.frame, 'y'));
        });
    }

    /** Back to the freshly loaded photo. */
    reset() {
        if (!this.img) return;
        this.animate(() => this.home());
    }

    /** Lock the frame to an aspect (w/h), or null for a free, resizable frame. Becomes the Reset baseline. */
    setAspectRatio(ratio: number | null) {
        this.baseAspect = ratio;
        this.animate(() => this.applyAspect(ratio));
    }

    private applyAspect(ratio: number | null) {
        this.aspect = ratio;
        this.frame = this.frameFor(ratio);
        this.view = this.clamp(this.view);
    }

    setShape(shape: CropShape) {
        this.shape = shape;
        this.applyShape();
        this.apply();
    }

    /** Stage height in px. */
    setHeight(px: number) {
        this.options.height = px;
        this.stage.style.height = `${px}px`;
        this.onStageResize();
    }

    private onStageResize() {
        if (this.destroyed) return;
        const next = this.frameFor(this.aspect);
        if (this.img && this.frame.w > 0) {
            this.view = this.clamp(refit(this.view, this.frame, next));
        }
        this.frame = next;
        this.apply();
    }

    // ─────────────────────────────────────────────────────────────── Export

    /** The framed region at native resolution (capped by `maxOutput`). Circles export as PNG. */
    async getBlob(mime = 'image/jpeg', quality = 0.92): Promise<Blob> {
        if (!this.img) throw new Error('No image loaded');
        const img = this.img;
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const v = this.view;
        const ow = this.frame.w / v.scale;
        const oh = this.frame.h / v.scale;
        const k = this.options.maxOutput ? Math.min(1, this.options.maxOutput / Math.max(ow, oh)) : 1;
        const out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(ow * k));
        out.height = Math.max(1, Math.round(oh * k));
        const ctx = out.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.imageSmoothingQuality = 'high';
        if (this.shape === 'circle') {
            ctx.beginPath();
            ctx.ellipse(out.width / 2, out.height / 2, out.width / 2, out.height / 2, 0, 0, Math.PI * 2);
            ctx.clip();
        }
        const p = toImage(center(this.frame), v, iw, ih);
        ctx.translate(out.width / 2, out.height / 2);
        ctx.scale(k * (v.flipX ? -1 : 1), k * (v.flipY ? -1 : 1));
        ctx.rotate((v.rotation * Math.PI) / 180);
        ctx.translate(-p.x, -p.y);
        ctx.drawImage(img, 0, 0, iw, ih);
        const type = this.shape === 'circle' && mime === 'image/jpeg' ? 'image/png' : mime;
        return new Promise((resolve, reject) => {
            out.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))), type, quality);
        });
    }

    // ─────────────────────────────────────────────────────────────── Pointer

    private stagePoint(e: { clientX: number; clientY: number }): Point {
        const r = this.stage.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    private startGesture(handle?: Handle) {
        const pts = [...this.pointers.values()];
        if (handle && pts.length === 1) {
            this.gesture = { kind: 'resize', handle, frame0: { ...this.frame }, p0: pts[0]! };
        } else if (pts.length >= 2) {
            const [a, b] = pts as [Point, Point];
            this.gesture = {
                kind: 'pinch',
                view0: { ...this.view },
                mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
                dist0: Math.hypot(b.x - a.x, b.y - a.y) || 1,
            };
        } else if (pts.length === 1) {
            this.gesture = { kind: 'pan', view0: { ...this.view }, p0: pts[0]! };
        } else {
            this.gesture = null;
        }
    }

    private onPointerDown = (e: PointerEvent) => {
        if (!this.img) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest('button')) return;
        e.preventDefault();
        this.stage.setPointerCapture?.(e.pointerId);
        this.root.focus({ preventScroll: true });
        this.pointers.set(e.pointerId, this.stagePoint(e));
        const handle = (target.closest('.ottacropper-handle') as HTMLElement | null)?.dataset.handle as
            | Handle
            | undefined;
        const keepResize = this.gesture?.kind === 'resize' && this.pointers.size > 1;
        if (!keepResize) this.startGesture(this.aspect === null ? handle : undefined);
        this.root.classList.add('ottacropper--interacting');
        this.root.classList.toggle('ottacropper--panning', this.gesture?.kind === 'pan');
    };

    private onPointerMove = (e: PointerEvent) => {
        if (!this.pointers.has(e.pointerId) || !this.gesture || !this.img) return;
        const p = this.stagePoint(e);
        this.pointers.set(e.pointerId, p);
        const g = this.gesture;
        if (g.kind === 'pan') {
            this.view = this.clamp({ ...g.view0, cx: g.view0.cx + p.x - g.p0.x, cy: g.view0.cy + p.y - g.p0.y });
        } else if (g.kind === 'pinch') {
            const [a, b] = [...this.pointers.values()] as [Point, Point];
            if (!b) return;
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const min = this.minScale();
            const scale = Math.min(min * this.options.maxZoom, Math.max(min, g.view0.scale * (dist / g.dist0)));
            const z = zoomAbout(g.view0, scale, g.mid0);
            this.view = this.clamp({ ...z, cx: z.cx + mid.x - g.mid0.x, cy: z.cy + mid.y - g.mid0.y });
        } else {
            const dx = p.x - g.p0.x;
            const dy = p.y - g.p0.y;
            const bounds = this.contentRect();
            const iw = this.img.naturalWidth;
            const ih = this.img.naturalHeight;
            // Grow only over photo: try the full move, then each axis alone
            for (const [mx, my] of [
                [dx, dy],
                [dx, 0],
                [0, dy],
            ] as const) {
                const candidate = resizeRect(g.frame0, g.handle, mx, my, bounds, MIN_FRAME);
                if (covers(this.view, candidate, iw, ih)) {
                    this.frame = candidate;
                    break;
                }
            }
        }
        this.apply();
    };

    private onPointerUp = (e: PointerEvent) => {
        if (!this.pointers.has(e.pointerId)) return;
        this.pointers.delete(e.pointerId);
        if (this.stage.hasPointerCapture?.(e.pointerId)) this.stage.releasePointerCapture(e.pointerId);
        const g = this.gesture;
        if (g?.kind === 'resize' && this.pointers.size === 0) {
            // The frame keeps its new proportions and grows back to fill the stage.
            this.gesture = null;
            this.animate(() => {
                const next = this.frameFor(null);
                this.view = this.clamp(refit(this.view, this.frame, next));
                this.frame = next;
            });
        } else {
            this.startGesture();
        }
        if (this.pointers.size === 0) {
            this.root.classList.remove('ottacropper--interacting', 'ottacropper--panning');
        }
    };

    private onWheel = (e: WheelEvent) => {
        if (!this.img) return;
        e.preventDefault();
        const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        const min = this.minScale();
        const scale = Math.min(min * this.options.maxZoom, Math.max(min, this.view.scale * Math.exp(-delta * 0.0025)));
        this.view = this.clamp(zoomAbout(this.view, scale, this.stagePoint(e)));
        this.touchGrid();
        this.apply();
    };

    private onDblClick = (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        this.reset();
    };

    private onKeyDown = (e: KeyboardEvent) => {
        if (!this.img) return;
        if ((e.target as HTMLElement).matches('input')) return;
        const step = e.shiftKey ? 10 : 1;
        const pan = (dx: number, dy: number) => {
            this.view = this.clamp({ ...this.view, cx: this.view.cx + dx, cy: this.view.cy + dy });
            this.touchGrid();
            this.apply();
        };
        switch (e.key) {
            case 'ArrowLeft':
                pan(-step, 0);
                break;
            case 'ArrowRight':
                pan(step, 0);
                break;
            case 'ArrowUp':
                pan(0, -step);
                break;
            case 'ArrowDown':
                pan(0, step);
                break;
            case '+':
            case '=':
                this.setZoom(this.getZoom() * 1.1);
                break;
            case '-':
            case '_':
                this.setZoom(this.getZoom() / 1.1);
                break;
            case 'r':
                this.rotate(90);
                break;
            case 'R':
                this.rotate(-90);
                break;
            case '0':
                this.reset();
                break;
            default:
                return;
        }
        e.preventDefault();
    };

    // ─────────────────────────────────────────────────────────────── Drag and drop

    private hasFiles(e: DragEvent) {
        return Array.from(e.dataTransfer?.types ?? []).includes('Files');
    }

    private onDragEnter = (e: DragEvent) => {
        if (!this.hasFiles(e)) return;
        e.preventDefault();
        this.dragDepth += 1;
        this.root.classList.add('ottacropper--dragover');
    };

    private onDragOver = (e: DragEvent) => {
        if (!this.hasFiles(e)) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    private onDragLeave = (e: DragEvent) => {
        if (this.dragDepth === 0) return;
        e.preventDefault();
        this.dragDepth -= 1;
        if (this.dragDepth === 0) this.root.classList.remove('ottacropper--dragover');
    };

    private onDrop = (e: DragEvent) => {
        e.preventDefault();
        this.dragDepth = 0;
        this.root.classList.remove('ottacropper--dragover');
        this.loadFromFile(e.dataTransfer?.files?.[0]);
    };

    // ─────────────────────────────────────────────────────────────── Teardown

    destroy() {
        this.destroyed = true;
        this.loadToken += 1;
        this.resizeObserver?.disconnect();
        if (this.gridTimer) clearTimeout(this.gridTimer);
        if (this.animTimer) clearTimeout(this.animTimer);
        this.stage.removeEventListener('pointerdown', this.onPointerDown);
        this.stage.removeEventListener('pointermove', this.onPointerMove);
        this.stage.removeEventListener('pointerup', this.onPointerUp);
        this.stage.removeEventListener('pointercancel', this.onPointerUp);
        this.stage.removeEventListener('wheel', this.onWheel);
        this.stage.removeEventListener('dblclick', this.onDblClick);
        this.root.removeEventListener('keydown', this.onKeyDown);
        this.root.removeEventListener('dragenter', this.onDragEnter);
        this.root.removeEventListener('dragover', this.onDragOver);
        this.root.removeEventListener('dragleave', this.onDragLeave);
        this.root.removeEventListener('drop', this.onDrop);
        if (this.ownsUrl && this.imageUrl) URL.revokeObjectURL(this.imageUrl);
        this.img = null;
        this.imageUrl = null;
        this.root.className = this.root.className
            .split(/\s+/)
            .filter((c) => c && !c.startsWith('ottacropper'))
            .join(' ');
        delete this.root.dataset.slot;
        this.root.removeAttribute('role');
        this.root.removeAttribute('aria-label');
        this.root.removeAttribute('tabindex');
        this.root.style.removeProperty('--cr-duration');
        this.root.innerHTML = '';
    }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    return node;
}

function matchMediaReduced(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
