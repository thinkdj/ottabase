/**
 * Vanilla image cropper: crop, flip, rotate, zoom with smooth transitions.
 * Zero dependencies. ~3–4 KB gzipped.
 */
import type { CropperOptions } from './types';
import { DEFAULT_ASPECT_PRESETS } from './types';

const ACCEPT = 'image/png,image/jpeg';
const MIN_SIZE = 16;

// Inline SVG icons (24x24) – no deps
const SVG_FLIP_H =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M12 20v2"/><path d="M12 14v2"/><path d="M12 8v2"/><path d="M12 2v2"/></svg>';
const SVG_FLIP_V =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/><path d="M4 12h16"/></svg>';
const SVG_ROTATE =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>';
const SVG_ZOOM_IN =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
const SVG_ZOOM_OUT =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
// Upload icon for the file picker button
const SVG_UPLOAD =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';

export class Cropper {
    private container: HTMLElement;
    private options: {
        aspectRatio: number | null;
        shape: 'rect' | 'circle';
        accept: string;
        maxHeight: number;
        transitions: boolean;
        transitionDuration: number;
        zoom: number;
        minZoom: number;
        maxZoom: number;
        aspectPresets: CropperOptions['aspectPresets'];
        onImageLoad?: () => void;
    };
    private presetBtns: Map<number | null, HTMLButtonElement> = new Map();
    private img: HTMLImageElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private wrap: HTMLDivElement | null = null;
    private fileInput: HTMLInputElement | null = null;
    private uploadBtn: HTMLButtonElement | null = null;
    private uploadBtnLabel: HTMLSpanElement | null = null;
    private hasLoadedImage = false;
    // Crop in rotated/visible coordinates (what user sees on screen)
    private crop = { x: 0, y: 0, w: 0, h: 0 };
    private flipH = false;
    private flipV = false;
    private rotation = 0; // 0, 90, 180, 270
    private zoom = 1;
    private drag = { active: false, startX: 0, startY: 0, startCropX: 0, startCropY: 0 };
    private displayScale = 1;
    private animating = false;
    private resizeHandle: {
        active: boolean;
        corner: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w' | null;
        startX: number;
        startY: number;
        startCrop: { x: number; y: number; w: number; h: number };
    } = { active: false, corner: null, startX: 0, startY: 0, startCrop: { x: 0, y: 0, w: 0, h: 0 } };

    constructor(container: HTMLElement, options: CropperOptions = {}) {
        this.container = container;
        this.options = {
            aspectRatio: options.aspectRatio ?? 1,
            shape: options.shape ?? 'rect',
            accept: options.accept ?? ACCEPT,
            maxHeight: options.maxHeight ?? 400,
            aspectPresets: options.aspectPresets ?? DEFAULT_ASPECT_PRESETS,
            transitions: options.transitions ?? true,
            transitionDuration: options.transitionDuration ?? 300,
            zoom: options.zoom ?? 1,
            minZoom: options.minZoom ?? 0.5,
            maxZoom: options.maxZoom ?? 3,
            onImageLoad: options.onImageLoad,
        };
        this.zoom = this.options.zoom;
        this.mount();
    }

    private mount() {
        this.container.innerHTML = '';
        this.container.style.cssText =
            'position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;';

        // Hidden file input + styled upload button + filename label
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = this.options.accept;
        input.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);border:0;';
        input.id = 'cropper-file-input';
        this.fileInput = input;

        const fileNameLabel = document.createElement('span');
        fileNameLabel.id = 'cropper-file-name';
        fileNameLabel.textContent = 'No file selected';
        fileNameLabel.style.cssText =
            'font-size:0.875rem;color:var(--muted-foreground, #888);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;';

        input.onchange = () => {
            const file = input.files?.[0];
            if (file) fileNameLabel.textContent = file.name;
            this.loadFile(file);
        };

        const uploadBtn = document.createElement('button');
        uploadBtn.type = 'button';
        uploadBtn.title = 'Choose image';
        const uploadLabel = document.createElement('span');
        uploadLabel.style.marginLeft = '6px';
        uploadLabel.textContent = 'Choose image';
        uploadBtn.innerHTML = SVG_UPLOAD;
        uploadBtn.appendChild(uploadLabel);
        this.uploadBtn = uploadBtn;
        this.uploadBtnLabel = uploadLabel;
        uploadBtn.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'gap:2px',
            'padding:6px 14px',
            'font-size:0.875rem',
            'font-weight:500',
            'line-height:1.25rem',
            'border-radius:6px',
            'cursor:pointer',
            'transition:background 150ms,border-color 150ms',
            'border:1px solid var(--border, #333)',
            'background:var(--background, transparent)',
            'color:var(--foreground, #fff)',
        ].join(';');
        uploadBtn.onmouseenter = () => {
            uploadBtn.style.background = 'var(--accent, rgba(255,255,255,0.08))';
        };
        uploadBtn.onmouseleave = () => {
            uploadBtn.style.background = 'var(--background, transparent)';
        };
        uploadBtn.onclick = () => {
            // Reset value so selecting the same file again still triggers onChange.
            input.value = '';
            input.click();
        };

        // Row wrapper for button + filename
        const fileRow = document.createElement('div');
        fileRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:4px;';
        fileRow.appendChild(uploadBtn);
        fileRow.appendChild(fileNameLabel);

        this.container.appendChild(input);
        this.container.appendChild(fileRow);

        this.wrap = document.createElement('div');
        // Transparent bg for compatibility and aesthetics (circle crop shows through; rect works fine too)
        this.wrap.style.cssText =
            'position:relative;overflow:hidden;background:transparent;border-radius:4px;display:none;';
        this.wrap.id = 'cropper-wrap';

        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'display:block;max-width:100%;height:auto;cursor:move;';
        this.wrap.appendChild(this.canvas);

        this.container.appendChild(this.wrap);

        // Controls
        const ctrl = document.createElement('div');
        ctrl.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center';
        const addBtn = (icon: string, title: string, fn: () => void) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.title = title;
            b.innerHTML = icon;
            b.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:6px';
            b.onclick = fn;
            ctrl.appendChild(b);
        };
        // Aspect presets (hidden until image loaded)
        if (this.options.aspectPresets && this.options.aspectPresets.length > 0) {
            const presetsEl = document.createElement('div');
            presetsEl.style.cssText = 'display:flex;gap:4px';
            presetsEl.id = 'cropper-presets';
            presetsEl.style.display = 'none';
            for (const { label, value } of this.options.aspectPresets) {
                const b = document.createElement('button');
                b.textContent = label;
                b.type = 'button';
                b.onclick = () => this.setAspectRatio(value);
                presetsEl.appendChild(b);
                this.presetBtns.set(value, b);
            }
            ctrl.appendChild(presetsEl);
        }
        addBtn(SVG_ZOOM_IN, 'Zoom in', () => this.zoomIn());
        addBtn(SVG_ZOOM_OUT, 'Zoom out', () => this.zoomOut());
        addBtn(SVG_FLIP_H, 'Flip horizontal', () => this.flipHorizontal());
        addBtn(SVG_FLIP_V, 'Flip vertical', () => this.flipVertical());
        addBtn(SVG_ROTATE, 'Rotate 90°', () => this.rotate());
        this.container.appendChild(ctrl);

        this.wrap.onmousedown = (e) => this.onMouseDown(e);
        this.wrap.onmousemove = (e) => this.onMouseMove(e);
        this.wrap.onmouseup = () => this.onMouseUp();
        this.wrap.onmouseleave = () => this.onMouseUp();
        this.wrap.onwheel = (e) => this.onWheel(e);
    }

    /** Public API: load image from File (e.g. after user selects from file input) */
    loadFromFile(file: File | undefined) {
        this.loadFile(file);
    }

    /** Public API: load image from a URL (http/https, blob:, or data: base64 URI) */
    loadFromUrl(url: string) {
        if (!url) return;
        this.img = new Image();
        // Allow cross-origin images to be exported via canvas
        if (!url.startsWith('data:') && !url.startsWith('blob:')) {
            this.img.crossOrigin = 'anonymous';
        }
        this.img.onload = () => {
            this.hasLoadedImage = true;
            this.updateUploadButtonLabel();
            this.rotation = 0;
            this.zoom = this.options.zoom;
            this.flipH = false;
            this.flipV = false;
            this.initCrop();
            this.container.querySelector<HTMLElement>('#cropper-wrap')!.style.display = 'block';
            const presetsEl = this.container.querySelector<HTMLElement>('#cropper-presets');
            if (presetsEl) presetsEl.style.display = 'flex';
            this.updatePresetActive();
            this.render();
            this.options.onImageLoad?.();
            // Update filename label if present
            const nameLabel = this.container.querySelector<HTMLElement>('#cropper-file-name');
            if (nameLabel) {
                if (url.startsWith('data:')) {
                    nameLabel.textContent = 'Image loaded';
                } else {
                    // Extract filename from URL path
                    try {
                        const pathname = new URL(url).pathname;
                        nameLabel.textContent = pathname.split('/').pop() || 'Image loaded';
                    } catch {
                        nameLabel.textContent = 'Image loaded';
                    }
                }
            }
        };
        this.img.onerror = () => {
            console.error('Cropper: failed to load image from URL');
        };
        this.img.src = url;
    }

    private loadFile(file: File | undefined) {
        if (!file || !file.type.match(/^image\/(png|jpeg|jpg)$/)) return;
        const url = URL.createObjectURL(file);
        this.img = new Image();
        this.img.onload = () => {
            URL.revokeObjectURL(url);
            this.hasLoadedImage = true;
            this.updateUploadButtonLabel();
            this.rotation = 0; // Reset rotation on new image
            this.zoom = this.options.zoom; // Reset zoom
            this.flipH = false;
            this.flipV = false;
            this.initCrop();
            this.container.querySelector<HTMLElement>('#cropper-wrap')!.style.display = 'block';
            const presetsEl = this.container.querySelector<HTMLElement>('#cropper-presets');
            if (presetsEl) presetsEl.style.display = 'flex';
            this.updatePresetActive();
            this.render();
            this.options.onImageLoad?.();
        };
        this.img.src = url;
    }

    private updateUploadButtonLabel() {
        const nextLabel = this.hasLoadedImage ? 'Replace image' : 'Choose image';
        if (this.uploadBtn) this.uploadBtn.title = nextLabel;
        if (this.uploadBtnLabel) this.uploadBtnLabel.textContent = nextLabel;
    }

    /** Get image dimensions in CURRENT rotation (what user sees) */
    private getRotatedImageDims() {
        if (!this.img) return { w: 0, h: 0 };
        const { naturalWidth: w, naturalHeight: h } = this.img;
        // 90° and 270° swap dimensions
        const is90or270 = this.rotation === 90 || this.rotation === 270;
        return is90or270 ? { w: h, h: w } : { w, h };
    }

    private initCrop() {
        const { w, h } = this.getRotatedImageDims();
        const ar = this.options.aspectRatio;
        let cw: number, ch: number;

        if (ar === null) {
            // Freeform - use 80% of image dimensions
            cw = w * 0.8;
            ch = h * 0.8;
        } else if (w / h >= ar) {
            ch = h;
            cw = h * ar;
        } else {
            cw = w;
            ch = w / ar;
        }

        cw = Math.max(MIN_SIZE, Math.min(cw, w));
        ch = Math.max(MIN_SIZE, Math.min(ch, h));
        this.crop = { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
        this.clampCrop();
    }

    /** Ensure crop rect stays within image bounds */
    private clampCrop() {
        if (!this.img) return;
        const { w, h } = this.getRotatedImageDims();
        this.crop.w = Math.max(MIN_SIZE, Math.min(this.crop.w, w));
        this.crop.h = Math.max(MIN_SIZE, Math.min(this.crop.h, h));
        this.crop.x = Math.max(0, Math.min(w - this.crop.w, this.crop.x));
        this.crop.y = Math.max(0, Math.min(h - this.crop.h, this.crop.y));
    }

    private render() {
        if (!this.img || !this.canvas || !this.wrap) return;
        this.clampCrop();

        const iw = this.img.naturalWidth;
        const ih = this.img.naturalHeight;

        // Calculate display scale
        this.displayScale = Math.min(1, this.options.maxHeight / Math.max(iw, ih));
        const scale = this.displayScale * this.zoom;

        // Canvas size in rotated space
        const { w: rotW, h: rotH } = this.getRotatedImageDims();
        const cw = Math.round(rotW * scale);
        const ch = Math.round(rotH * scale);

        // Apply smooth transition to wrapper for rotation animation (uses theme vars when available)
        if (this.options.transitions && !this.drag.active && !this.resizeHandle.active) {
            this.wrap.style.transition = `all var(--duration-normal, ${this.options.transitionDuration}ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1))`;
        } else {
            this.wrap.style.transition = 'none';
        }

        // Set wrapper dimensions (animated during rotation)
        this.wrap.style.width = `${cw}px`;
        this.wrap.style.height = `${ch}px`;

        this.canvas.width = cw;
        this.canvas.height = ch;
        const ctx = this.canvas.getContext('2d')!;

        // Clear canvas
        ctx.clearRect(0, 0, cw, ch);

        // Draw image with transformations at center
        ctx.save();
        ctx.translate(cw / 2, ch / 2);
        ctx.rotate((this.rotation * Math.PI) / 180);
        if (this.flipH) ctx.scale(-1, 1);
        if (this.flipV) ctx.scale(1, -1);

        // Draw at natural orientation, scaled
        const drawW = iw * scale;
        const drawH = ih * scale;
        ctx.drawImage(this.img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        // Draw overlay (crop area is in rotated coordinates)
        const ox = this.crop.x * scale;
        const oy = this.crop.y * scale;
        const ow = this.crop.w * scale;
        const oh = this.crop.h * scale;

        // Dark overlay
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, cw, ch);
        ctx.globalCompositeOperation = 'destination-out';

        // Cut out the crop area (circle or rect)
        if (this.options.shape === 'circle') {
            ctx.beginPath();
            ctx.ellipse(ox + ow / 2, oy + oh / 2, ow / 2, oh / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(ox, oy, ow, oh);
        }

        ctx.globalCompositeOperation = 'source-over';

        // Crop border
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        if (this.options.shape === 'circle') {
            ctx.beginPath();
            ctx.ellipse(ox + ow / 2, oy + oh / 2, ow / 2, oh / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.strokeRect(ox, oy, ow, oh);
        }

        // Draw resize handles (for both rect and circle)
        this.drawResizeHandles(ctx, ox, oy, ow, oh);

        // Grid lines (rule of thirds)
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        if (this.options.shape === 'rect') {
            ctx.beginPath();
            // Vertical lines
            ctx.moveTo(ox + ow / 3, oy);
            ctx.lineTo(ox + ow / 3, oy + oh);
            ctx.moveTo(ox + (2 * ow) / 3, oy);
            ctx.lineTo(ox + (2 * ow) / 3, oy + oh);
            // Horizontal lines
            ctx.moveTo(ox, oy + oh / 3);
            ctx.lineTo(ox + ow, oy + oh / 3);
            ctx.moveTo(ox, oy + (2 * oh) / 3);
            ctx.lineTo(ox + ow, oy + (2 * oh) / 3);
            ctx.stroke();
        }
    }

    private drawResizeHandles(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
        const handleSize = 10;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;

        const handles = [
            { x: x - handleSize / 2, y: y - handleSize / 2 }, // nw
            { x: x + w - handleSize / 2, y: y - handleSize / 2 }, // ne
            { x: x - handleSize / 2, y: y + h - handleSize / 2 }, // sw
            { x: x + w - handleSize / 2, y: y + h - handleSize / 2 }, // se
            { x: x + w / 2 - handleSize / 2, y: y - handleSize / 2 }, // n
            { x: x + w - handleSize / 2, y: y + h / 2 - handleSize / 2 }, // e
            { x: x + w / 2 - handleSize / 2, y: y + h - handleSize / 2 }, // s
            { x: x - handleSize / 2, y: y + h / 2 - handleSize / 2 }, // w
        ];

        for (const handle of handles) {
            ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
            ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
        }
    }

    private getResizeHandleAtPoint(mx: number, my: number, ox: number, oy: number, ow: number, oh: number) {
        const handleSize = 10;
        const tolerance = 5;

        const handles: Array<{ corner: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w'; x: number; y: number }> = [
            { corner: 'nw', x: ox, y: oy },
            { corner: 'ne', x: ox + ow, y: oy },
            { corner: 'sw', x: ox, y: oy + oh },
            { corner: 'se', x: ox + ow, y: oy + oh },
            { corner: 'n', x: ox + ow / 2, y: oy },
            { corner: 'e', x: ox + ow, y: oy + oh / 2 },
            { corner: 's', x: ox + ow / 2, y: oy + oh },
            { corner: 'w', x: ox, y: oy + oh / 2 },
        ];

        for (const handle of handles) {
            const dist = Math.sqrt((mx - handle.x) ** 2 + (my - handle.y) ** 2);
            if (dist < handleSize + tolerance) {
                return handle.corner;
            }
        }
        return null;
    }

    /** Get mouse position in canvas coordinates */
    private getCanvasCoords(e: MouseEvent): { x: number; y: number } | null {
        if (!this.canvas) return null;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    }

    private onMouseDown(e: MouseEvent) {
        if (!this.img || !this.canvas || !this.wrap) return;
        if (!this.wrap.contains(e.target as Node)) return;

        const coords = this.getCanvasCoords(e);
        if (!coords) return;

        const scale = this.displayScale * this.zoom;
        const ox = this.crop.x * scale;
        const oy = this.crop.y * scale;
        const ow = this.crop.w * scale;
        const oh = this.crop.h * scale;

        // Check if clicking on resize handle (for both rect and circle)
        const handle = this.getResizeHandleAtPoint(coords.x, coords.y, ox, oy, ow, oh);
        if (handle) {
            this.resizeHandle = {
                active: true,
                corner: handle,
                startX: e.clientX,
                startY: e.clientY,
                startCrop: { ...this.crop },
            };
            this.canvas.style.cursor = this.getCursorForHandle(handle);
            return;
        }

        // Check if clicking inside crop area for drag
        if (coords.x >= ox && coords.x <= ox + ow && coords.y >= oy && coords.y <= oy + oh) {
            this.drag = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                startCropX: this.crop.x,
                startCropY: this.crop.y,
            };
        }
    }

    private getCursorForHandle(handle: string): string {
        const cursors: Record<string, string> = {
            nw: 'nwse-resize',
            ne: 'nesw-resize',
            sw: 'nesw-resize',
            se: 'nwse-resize',
            n: 'ns-resize',
            e: 'ew-resize',
            s: 'ns-resize',
            w: 'ew-resize',
        };
        return cursors[handle] || 'default';
    }

    private onMouseMove(e: MouseEvent) {
        if (!this.img || !this.canvas) return;

        const coords = this.getCanvasCoords(e);
        if (!coords) return;

        const scale = this.displayScale * this.zoom;

        // Handle resize
        if (this.resizeHandle.active && this.resizeHandle.corner) {
            this.handleResize(e);
            return;
        }

        // Handle drag
        if (this.drag.active) {
            const dx = e.clientX - this.drag.startX;
            const dy = e.clientY - this.drag.startY;

            // Convert screen delta to crop space (accounting for scale only, rotation is already in crop space)
            const rect = this.canvas.getBoundingClientRect();
            const screenScaleX = this.canvas.width / rect.width;
            const screenScaleY = this.canvas.height / rect.height;

            const cropDx = (dx * screenScaleX) / scale;
            const cropDy = (dy * screenScaleY) / scale;

            const { w, h } = this.getRotatedImageDims();
            this.crop.x = Math.max(0, Math.min(w - this.crop.w, this.drag.startCropX + cropDx));
            this.crop.y = Math.max(0, Math.min(h - this.crop.h, this.drag.startCropY + cropDy));
            this.render();
            return;
        }

        // Update cursor for hover over handles
        const ox = this.crop.x * scale;
        const oy = this.crop.y * scale;
        const ow = this.crop.w * scale;
        const oh = this.crop.h * scale;

        // Check handles for both rect and circle
        const handle = this.getResizeHandleAtPoint(coords.x, coords.y, ox, oy, ow, oh);
        if (handle) {
            this.canvas.style.cursor = this.getCursorForHandle(handle);
            return;
        }

        // Check if hovering over crop area
        if (coords.x >= ox && coords.x <= ox + ow && coords.y >= oy && coords.y <= oy + oh) {
            this.canvas.style.cursor = 'move';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    private handleResize(e: MouseEvent) {
        if (!this.resizeHandle.corner || !this.canvas) return;

        const dx = e.clientX - this.resizeHandle.startX;
        const dy = e.clientY - this.resizeHandle.startY;

        const rect = this.canvas.getBoundingClientRect();
        const screenScaleX = this.canvas.width / rect.width;
        const screenScaleY = this.canvas.height / rect.height;

        const scale = this.displayScale * this.zoom;
        const { w, h } = this.getRotatedImageDims();
        const corner = this.resizeHandle.corner;
        const startCrop = this.resizeHandle.startCrop;
        const ar = this.options.aspectRatio;

        let newX = startCrop.x;
        let newY = startCrop.y;
        let newW = startCrop.w;
        let newH = startCrop.h;

        const cropDx = (dx * screenScaleX) / scale;
        const cropDy = (dy * screenScaleY) / scale;

        // Handle corner and edge resizing
        if (corner.includes('w')) {
            newX = startCrop.x + cropDx;
            newW = startCrop.w - cropDx;
        }
        if (corner.includes('e')) {
            newW = startCrop.w + cropDx;
        }
        if (corner.includes('n')) {
            newY = startCrop.y + cropDy;
            newH = startCrop.h - cropDy;
        }
        if (corner.includes('s')) {
            newH = startCrop.h + cropDy;
        }

        // Maintain aspect ratio (if not freeform)
        // For circles, always maintain 1:1 aspect ratio (square)
        const effectiveAr = this.options.shape === 'circle' ? 1 : ar;

        if (effectiveAr !== null) {
            if (corner === 'nw' || corner === 'ne' || corner === 'sw' || corner === 'se') {
                // Corner resize - maintain aspect ratio
                const aspectW = newH * effectiveAr;
                const aspectH = newW / effectiveAr;

                if (Math.abs(newW - aspectW) < Math.abs(newH - aspectH)) {
                    newW = aspectW;
                } else {
                    newH = aspectH;
                }

                // Adjust position for corners
                if (corner.includes('w')) {
                    newX = startCrop.x + startCrop.w - newW;
                }
                if (corner.includes('n')) {
                    newY = startCrop.y + startCrop.h - newH;
                }
            } else {
                // Edge resize - adjust other dimension to maintain aspect ratio
                if (corner === 'n' || corner === 's') {
                    newW = newH * effectiveAr;
                    newX = startCrop.x + (startCrop.w - newW) / 2;
                } else {
                    newH = newW / effectiveAr;
                    newY = startCrop.y + (startCrop.h - newH) / 2;
                }
            }
        }
        // For freeform (ar === null) and shape !== 'circle', dimensions are already set above - no adjustment needed

        // Apply constraints
        newW = Math.max(MIN_SIZE, Math.min(newW, w));
        newH = Math.max(MIN_SIZE, Math.min(newH, h));
        newX = Math.max(0, Math.min(w - newW, newX));
        newY = Math.max(0, Math.min(h - newH, newY));

        this.crop = { x: newX, y: newY, w: newW, h: newH };
        this.render();
    }

    private onMouseUp() {
        this.drag.active = false;
        this.resizeHandle.active = false;
        this.resizeHandle.corner = null;
        if (this.canvas) {
            this.canvas.style.cursor = 'move';
        }
    }

    private onWheel(e: WheelEvent) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.setZoom(this.zoom + delta);
    }

    /** Flip horizontally */
    flipHorizontal() {
        this.flipH = !this.flipH;
        this.animateTransform(() => {
            this.render();
        });
    }

    /** Flip vertically */
    flipVertical() {
        this.flipV = !this.flipV;
        this.animateTransform(() => {
            this.render();
        });
    }

    /** Rotate 90° clockwise with smooth transition */
    rotate() {
        this.animateTransform(() => {
            this.rotation = (this.rotation + 90) % 360;
            // Reinitialize crop for new dimensions
            this.initCrop();
            this.render();
        });
    }

    /** Zoom in */
    zoomIn() {
        this.setZoom(this.zoom + 0.2);
    }

    /** Zoom out */
    zoomOut() {
        this.setZoom(this.zoom - 0.2);
    }

    /** Set zoom level */
    setZoom(level: number) {
        let newZoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, level));

        // Calculate what the canvas size would be at this zoom
        if (this.img) {
            const { w: rotW, h: rotH } = this.getRotatedImageDims();
            const iw = this.img.naturalWidth;
            const ih = this.img.naturalHeight;
            this.displayScale = Math.min(1, this.options.maxHeight / Math.max(iw, ih));
            const testScale = this.displayScale * newZoom;
            const testW = rotW * testScale;
            const testH = rotH * testScale;
            const maxDim = Math.max(testW, testH);

            // If zooming would exceed maxHeight, clamp the zoom to the maximum that fits
            if (maxDim > this.options.maxHeight) {
                const maxAllowedZoom = this.options.maxHeight / (Math.max(rotW, rotH) * this.displayScale);
                newZoom = Math.min(newZoom, maxAllowedZoom);
            }
        }

        if (Math.abs(newZoom - this.zoom) < 0.01) return;
        this.animateTransform(() => {
            this.zoom = newZoom;
            this.render();
        });
    }

    /** Get current zoom level */
    getZoom(): number {
        return this.zoom;
    }

    private animateTransform(fn: () => void) {
        if (this.options.transitions) {
            if (this.animating) return;
            this.animating = true;
            fn();
            setTimeout(() => {
                this.animating = false;
            }, this.options.transitionDuration);
        } else {
            fn();
        }
    }

    /** Set aspect ratio and reinit crop (e.g. 1, 4/3, 16/9, null for freeform) */
    setAspectRatio(ratio: number | null) {
        this.options.aspectRatio = ratio;
        if (this.img) {
            this.animateTransform(() => {
                this.initCrop();
                this.updatePresetActive();
                this.render();
            });
        }
    }

    /** Set viewfinder shape: rect or circle */
    setShape(shape: 'rect' | 'circle') {
        this.options.shape = shape;
        this.render();
    }

    /** Set max display height in px */
    setMaxHeight(h: number) {
        this.options.maxHeight = h;
        this.render();
    }

    /** Show or hide aspect preset buttons */
    setPresetsVisible(visible: boolean) {
        const el = this.container.querySelector<HTMLElement>('#cropper-presets');
        if (el) el.style.display = visible ? 'flex' : 'none';
    }

    /** Enable or disable smooth transitions without resetting the loaded image */
    setTransitions(enabled: boolean) {
        this.options.transitions = enabled;
    }

    /** Set transition duration in ms without resetting the loaded image */
    setTransitionDuration(ms: number) {
        this.options.transitionDuration = ms;
    }

    private updatePresetActive() {
        const ar = this.options.aspectRatio;
        const activeStyle = 'font-weight:600';
        const inactiveStyle = 'font-weight:400';
        for (const [value, btn] of this.presetBtns) {
            const isActive =
                ar === null && value === null ? true : ar !== null && value !== null && Math.abs(value - ar) < 1e-6;
            btn.style.cssText = isActive ? activeStyle : inactiveStyle;
        }
    }

    /** Export cropped image as Blob. Use PNG for circle shape (transparent corners); JPEG for rect. */
    async getBlob(mime: 'image/png' | 'image/jpeg' = 'image/jpeg', quality = 0.92): Promise<Blob> {
        if (!this.img) throw new Error('No image loaded');

        // Circle shape needs PNG for transparent corners; JPEG would render them black
        const effectiveMime = this.options.shape === 'circle' ? 'image/png' : mime;

        const out = document.createElement('canvas');
        out.width = Math.round(this.crop.w);
        out.height = Math.round(this.crop.h);
        const ctx = out.getContext('2d')!;

        if (this.options.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(out.width / 2, out.height / 2, Math.min(out.width, out.height) / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
        }

        const iw = this.img.naturalWidth;
        const ih = this.img.naturalHeight;

        // Draw the cropped region with all transformations applied
        ctx.save();

        // Move to center of output canvas
        ctx.translate(out.width / 2, out.height / 2);

        // Apply rotation
        ctx.rotate((this.rotation * Math.PI) / 180);

        // Apply flips
        if (this.flipH) ctx.scale(-1, 1);
        if (this.flipV) ctx.scale(1, -1);

        // Now we need to figure out where to draw from in the original image
        // The crop coordinates are in rotated space, we need to map back
        const { w: rotW, h: rotH } = this.getRotatedImageDims();

        // Calculate source region in original image after accounting for rotation
        let sx: number, sy: number, sw: number, sh: number;

        if (this.rotation === 0) {
            sx = this.crop.x;
            sy = this.crop.y;
            sw = this.crop.w;
            sh = this.crop.h;
        } else if (this.rotation === 90) {
            // 90° CW: top-left of crop in rotated space maps to top-right in original
            sx = rotW - this.crop.y - this.crop.h;
            sy = this.crop.x;
            sw = this.crop.h;
            sh = this.crop.w;
        } else if (this.rotation === 180) {
            sx = rotW - this.crop.x - this.crop.w;
            sy = rotH - this.crop.y - this.crop.h;
            sw = this.crop.w;
            sh = this.crop.h;
        } else {
            // 270° CW
            sx = this.crop.y;
            sy = rotH - this.crop.x - this.crop.w;
            sw = this.crop.h;
            sh = this.crop.w;
        }

        // Draw centered
        ctx.drawImage(this.img, sx, sy, sw, sh, -out.width / 2, -out.height / 2, out.width, out.height);
        ctx.restore();

        return new Promise((resolve, reject) => {
            out.toBlob(
                (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
                effectiveMime,
                effectiveMime === 'image/jpeg' ? quality : undefined,
            );
        });
    }

    /** Remove DOM and cleanup */
    destroy() {
        this.img = null;
        this.canvas = null;
        this.wrap = null;
        this.fileInput = null;
        this.uploadBtn = null;
        this.uploadBtnLabel = null;
        this.hasLoadedImage = false;
        this.container.innerHTML = '';
    }
}
