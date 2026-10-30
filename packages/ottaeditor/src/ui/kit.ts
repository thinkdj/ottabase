/**
 * The block UI kit: every control a custom block renders inside the editor, built once and styled
 * once (`oe-*` classes in styles/ottaeditor.css). Tools compose these instead of hand-building
 * inputs, so labels, sizes, focus rings, hover tints and keyboard behaviour are identical across
 * all seventeen blocks.
 *
 * Plain DOM, no framework: Editor.js tools are vanilla classes. Each helper returns an element
 * (or a small handle when it needs cleanup) and reports changes through callbacks.
 */
import { icon, type IconName } from './icons';

let seed = 0;
/** A unique id for a control, for `label[for]` and aria wiring */
export const uid = (prefix = 'oe') => `${prefix}-${++seed}-${Math.random().toString(36).slice(2, 6)}`;

type Child = Node | string | null | undefined | false;

/** Tiny hyperscript: `h('div', { className: 'x', onClick }, child, …)`. Strings become text nodes. */
export function h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Partial<Record<string, unknown>> & { className?: string; dataset?: Record<string, string> } = {},
    ...children: Child[]
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === null || value === false) continue;
        if (key === 'className') node.className = String(value);
        else if (key === 'dataset') Object.assign(node.dataset, value as Record<string, string>);
        else if (key === 'html')
            node.innerHTML = String(value); // only ever our own SVG strings
        else if (key.startsWith('on') && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
        } else if (
            key in node &&
            typeof (node as unknown as Record<string, unknown>)[key] !== 'undefined' &&
            key !== 'style'
        ) {
            (node as unknown as Record<string, unknown>)[key] = value;
        } else node.setAttribute(key, String(value));
    }
    for (const child of children) {
        if (child === null || child === undefined || child === false) continue;
        node.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
}

/** An SVG icon as a node */
export const iconEl = (name: IconName, size = 16) => h('span', { className: 'oe-icon', html: icon(name, size) });

// ─────────────────────────────────────────────────────────────── Layout

/** A label above (or beside) a control, with an optional hint under it. */
export function field(opts: { label: string; control: HTMLElement; hint?: string; inline?: boolean; grow?: boolean }) {
    const control = opts.control;
    // The label points at the control's own input, but never at a switch or radio inside a group of them:
    // that would give the first switch the field's name.
    const target = control.matches('input, select, textarea')
        ? control
        : control.querySelector('input:not([role=switch]):not([type=checkbox]), select, textarea');
    if (target && !target.id) target.id = uid('f');
    const label = h('label', { className: 'oe-label', htmlFor: target?.id }, opts.label);
    return h(
        'div',
        { className: `oe-field${opts.inline ? ' oe-field--inline' : ''}${opts.grow ? ' oe-field--grow' : ''}` },
        label,
        control,
        opts.hint ? h('p', { className: 'oe-hint' }, opts.hint) : null,
    );
}

/** Fields side by side; wraps on narrow blocks. */
export const row = (...children: Child[]) => h('div', { className: 'oe-row' }, ...children);

/** A vertical stack of fields with the kit's rhythm. */
export const stack = (...children: Child[]) => h('div', { className: 'oe-stack' }, ...children);

/** A micro-label heading for a group of fields */
export const sectionLabel = (text: string) => h('div', { className: 'oe-section-label' }, text);

// ─────────────────────────────────────────────────────────────── Inputs

export function textInput(opts: {
    value: string;
    placeholder?: string;
    type?: 'text' | 'url' | 'number';
    ariaLabel?: string;
    size?: 'sm';
    min?: number;
    max?: number;
    onInput?: (value: string) => void;
    /** Fires on blur and Enter, for inputs whose value is validated as a whole */
    onCommit?: (value: string) => void;
}) {
    const input = h('input', {
        className: `oe-input${opts.size ? ` oe-input--${opts.size}` : ''}`,
        type: opts.type ?? 'text',
        value: opts.value,
        placeholder: opts.placeholder ?? '',
        'aria-label': opts.ariaLabel,
        min: opts.min,
        max: opts.max,
    });
    if (opts.onInput) input.addEventListener('input', () => opts.onInput!(input.value));
    if (opts.onCommit) {
        input.addEventListener('blur', () => opts.onCommit!(input.value));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            }
        });
    }
    return input;
}

export function textarea(opts: {
    value: string;
    placeholder?: string;
    rows?: number;
    ariaLabel?: string;
    mono?: boolean;
    onInput?: (value: string) => void;
}) {
    const el = h('textarea', {
        className: `oe-textarea${opts.mono ? ' oe-textarea--mono' : ''}`,
        value: opts.value,
        placeholder: opts.placeholder ?? '',
        rows: opts.rows ?? 3,
        'aria-label': opts.ariaLabel,
        spellcheck: opts.mono ? false : undefined,
    });
    if (opts.onInput) el.addEventListener('input', () => opts.onInput!(el.value));
    return el;
}

export function select<T extends string>(opts: {
    value: T;
    options: ReadonlyArray<{ value: T; label: string }>;
    ariaLabel?: string;
    size?: 'sm';
    onChange: (value: T) => void;
}) {
    const el = h('select', {
        className: `oe-select${opts.size ? ` oe-select--${opts.size}` : ''}`,
        'aria-label': opts.ariaLabel,
    });
    for (const o of opts.options) el.append(h('option', { value: o.value, selected: o.value === opts.value }, o.label));
    el.addEventListener('change', () => opts.onChange(el.value as T));
    return el;
}

/**
 * A segmented control: the kit's answer to "pick one of a few". Icon-only, text, or both.
 * Radio semantics for assistive tech, arrow keys move the choice.
 */
export function segment<T extends string>(opts: {
    value: T;
    options: ReadonlyArray<{ value: T; label?: string; icon?: IconName; title?: string }>;
    ariaLabel: string;
    onChange: (value: T) => void;
}) {
    let current = opts.value;
    const group = h('div', { className: 'oe-segment', role: 'radiogroup', 'aria-label': opts.ariaLabel });
    const buttons = opts.options.map((o) => {
        const b = h(
            'button',
            {
                type: 'button',
                role: 'radio',
                className: 'oe-segment__btn',
                title: o.title ?? o.label,
                'aria-label': o.label ?? o.title,
                'aria-checked': String(o.value === current),
                tabIndex: o.value === current ? 0 : -1,
            },
            o.icon ? iconEl(o.icon) : null,
            o.label ? h('span', {}, o.label) : null,
        );
        b.addEventListener('click', () => set(o.value));
        return b;
    });
    const set = (value: T) => {
        current = value;
        buttons.forEach((b, i) => {
            const on = opts.options[i]!.value === value;
            b.setAttribute('aria-checked', String(on));
            b.tabIndex = on ? 0 : -1;
        });
        opts.onChange(value);
    };
    group.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const i = opts.options.findIndex((o) => o.value === current);
        const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + opts.options.length) % opts.options.length;
        set(opts.options[next]!.value);
        buttons[next]!.focus();
    });
    group.append(...buttons);
    return group;
}

/** A switch with its label; the whole row is the hit target. */
export function toggle(opts: { checked: boolean; label: string; hint?: string; onChange: (checked: boolean) => void }) {
    const id = uid('sw');
    const input = h('input', {
        type: 'checkbox',
        className: 'oe-switch__input',
        id,
        checked: opts.checked,
        role: 'switch',
    });
    input.addEventListener('change', () => opts.onChange(input.checked));
    return h(
        'label',
        { className: 'oe-switch', htmlFor: id },
        input,
        h(
            'span',
            { className: 'oe-switch__track', 'aria-hidden': 'true' },
            h('span', { className: 'oe-switch__thumb' }),
        ),
        h(
            'span',
            { className: 'oe-switch__text' },
            h('span', {}, opts.label),
            opts.hint ? h('span', { className: 'oe-hint' }, opts.hint) : null,
        ),
    );
}

export function checkbox(opts: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
    const id = uid('cb');
    const input = h('input', { type: 'checkbox', className: 'oe-checkbox', id, checked: opts.checked });
    input.addEventListener('change', () => opts.onChange(input.checked));
    return h('label', { className: 'oe-check', htmlFor: id }, input, h('span', {}, opts.label));
}

export function range(opts: {
    value: number;
    min: number;
    max: number;
    step?: number;
    ariaLabel: string;
    onInput: (value: number) => void;
}) {
    const el = h('input', {
        type: 'range',
        className: 'oe-range',
        min: opts.min,
        max: opts.max,
        step: opts.step ?? 1,
        value: opts.value,
        'aria-label': opts.ariaLabel,
    });
    el.addEventListener('input', () => opts.onInput(Number(el.value)));
    return el;
}

/** Star rating input: click a star to set, click it again to clear. */
export function stars(opts: { value: number; max?: number; onChange: (value: number) => void }) {
    const max = opts.max ?? 5;
    let current = opts.value;
    const wrap = h('div', { className: 'oe-stars', role: 'group', 'aria-label': 'Rating' });
    const value = h('span', { className: 'oe-hint oe-stars__value' });
    const paint = () => {
        wrap.querySelectorAll<HTMLButtonElement>('.oe-stars__star').forEach((b, i) =>
            b.classList.toggle('oe-stars__star--on', i < current),
        );
        value.textContent = current > 0 ? `${current}/${max}` : 'None';
    };
    for (let i = 1; i <= max; i++) {
        const b = h('button', {
            type: 'button',
            className: 'oe-stars__star',
            'aria-label': `Rate ${i} out of ${max}`,
            html: icon('star', 16),
        });
        b.addEventListener('click', () => {
            current = current === i ? 0 : i;
            paint();
            opts.onChange(current);
        });
        wrap.append(b);
    }
    paint();
    return h('div', { className: 'oe-stars-row' }, wrap, value);
}

// ─────────────────────────────────────────────────────────────── Buttons

export function button(opts: {
    label: string;
    icon?: IconName;
    variant?: 'ghost' | 'outline' | 'primary' | 'danger';
    size?: 'sm';
    title?: string;
    disabled?: boolean;
    onClick: (e: MouseEvent) => void;
}) {
    const b = h(
        'button',
        {
            type: 'button',
            className: `oe-btn oe-btn--${opts.variant ?? 'outline'}${opts.size ? ` oe-btn--${opts.size}` : ''}`,
            title: opts.title,
            disabled: opts.disabled,
        },
        opts.icon ? iconEl(opts.icon) : null,
        h('span', {}, opts.label),
    );
    b.addEventListener('click', (e) => opts.onClick(e));
    return b;
}

/** Icon-only action; `label` is required because there is no visible text. */
export function iconButton(opts: {
    icon: IconName;
    label: string;
    danger?: boolean;
    disabled?: boolean;
    pressed?: boolean;
    onClick: (e: MouseEvent) => void;
}) {
    const b = h('button', {
        type: 'button',
        className: `oe-icon-btn${opts.danger ? ' oe-icon-btn--danger' : ''}`,
        'aria-label': opts.label,
        title: opts.label,
        disabled: opts.disabled,
        'aria-pressed': opts.pressed === undefined ? undefined : String(opts.pressed),
        html: icon(opts.icon),
    });
    b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        opts.onClick(e);
    });
    return b;
}

/** The dashed "add another" affordance under a list */
export function addButton(label: string, onClick: () => void) {
    const b = h(
        'button',
        { type: 'button', className: 'oe-add', 'aria-label': label },
        iconEl('plus'),
        h('span', {}, label),
    );
    b.addEventListener('click', (e) => {
        e.preventDefault();
        onClick();
    });
    return b;
}

// ─────────────────────────────────────────────────────────────── Composite controls

export type ImagePosition =
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'left'
    | 'center'
    | 'right'
    | 'bottom-left'
    | 'bottom'
    | 'bottom-right';
export const IMAGE_POSITIONS: ImagePosition[] = [
    'top-left',
    'top',
    'top-right',
    'left',
    'center',
    'right',
    'bottom-left',
    'bottom',
    'bottom-right',
];

/** CSS `object-position` for a preset */
export function positionToCSS(pos: ImagePosition | undefined): string {
    const map: Record<ImagePosition, string> = {
        'top-left': 'left top',
        top: 'center top',
        'top-right': 'right top',
        left: 'left center',
        center: 'center center',
        right: 'right center',
        'bottom-left': 'left bottom',
        bottom: 'center bottom',
        'bottom-right': 'right bottom',
    };
    return map[pos ?? 'center'];
}

/** 3×3 focal-point picker for cover-fit images */
export function positionGrid(opts: {
    value: ImagePosition;
    ariaLabel: string;
    onChange: (pos: ImagePosition) => void;
}) {
    let current = opts.value;
    const grid = h('div', { className: 'oe-posgrid', role: 'radiogroup', 'aria-label': opts.ariaLabel });
    for (const pos of IMAGE_POSITIONS) {
        const b = h('button', {
            type: 'button',
            role: 'radio',
            className: 'oe-posgrid__cell',
            'aria-label': pos.replace('-', ' '),
            title: pos.replace('-', ' '),
            'aria-checked': String(pos === current),
        });
        b.addEventListener('click', () => {
            current = pos;
            grid.querySelectorAll('.oe-posgrid__cell').forEach((c) => c.setAttribute('aria-checked', String(c === b)));
            opts.onChange(pos);
        });
        grid.append(b);
    }
    return grid;
}

/**
 * A text input with an inline confirmation step: "Remove? [Remove] [Keep]". Replaces window.confirm
 * and the per-tool event bridges. Resolves true when confirmed.
 */
export function confirmInline(host: HTMLElement, message: string, confirmLabel = 'Remove'): Promise<boolean> {
    return new Promise((resolve) => {
        const bar = h(
            'div',
            { className: 'oe-confirm', role: 'alertdialog', 'aria-label': message },
            h('span', { className: 'oe-confirm__text' }, message),
        );
        const done = (ok: boolean) => {
            bar.remove();
            resolve(ok);
        };
        bar.append(
            button({ label: confirmLabel, variant: 'danger', size: 'sm', onClick: () => done(true) }),
            button({ label: 'Keep', variant: 'ghost', size: 'sm', onClick: () => done(false) }),
        );
        host.append(bar);
        (bar.querySelector('button') as HTMLButtonElement | null)?.focus();
    });
}

// ─────────────────────────────────────────────────────────────── Media library bridge

export type MediaKindFilter = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

export interface MediaSelection {
    id?: string;
    url: string;
    title?: string;
    originalName?: string;
    altText?: string;
    caption?: string;
    mediaId?: string;
    mimeType?: string;
    mediaKind?: string;
    thumbnailUrl?: string;
    previewUrl?: string;
    width?: number;
    height?: number;
}

/**
 * Ask the host app to open its media picker. The app answers with a `media-library-selected-item`
 * event carrying the same `field` token, which `onMediaSelected` routes back to the caller.
 */
export function openMediaLibrary(field: string, opts: { accept?: MediaKindFilter[]; multiselect?: boolean } = {}) {
    window.dispatchEvent(
        new CustomEvent('media-library-open', {
            detail: { source: 'editor', field, acceptKinds: opts.accept, multiselect: opts.multiselect },
        }),
    );
}

/** Subscribe to picker results for one field token. Returns the unsubscribe function. */
export function onMediaSelected(field: string, handler: (media: MediaSelection) => void): () => void {
    const listener = (e: Event) => {
        const detail = (e as CustomEvent<{ field?: string; media?: MediaSelection }>).detail;
        if (detail?.field === field && detail.media?.url) handler(detail.media);
    };
    window.addEventListener('media-library-selected-item', listener);
    return () => window.removeEventListener('media-library-selected-item', listener);
}

/**
 * The one way a block asks for an image or file: a URL input with a "Library" button beside it and
 * a thumbnail once something is chosen. Returns the element and a `destroy` to drop the picker
 * subscription when the block unmounts.
 */
export function mediaInput(opts: {
    value: string;
    placeholder?: string;
    ariaLabel: string;
    accept?: MediaKindFilter[];
    /** Hide the thumbnail strip (for non-image media) */
    noThumb?: boolean;
    onChange: (url: string, media?: MediaSelection) => void;
}): { element: HTMLElement; destroy: () => void; setValue: (url: string) => void } {
    const field = uid('media');
    const input = textInput({
        value: opts.value,
        placeholder: opts.placeholder ?? 'https://…',
        type: 'url',
        ariaLabel: opts.ariaLabel,
        onInput: (v) => update(v),
    });
    const thumb = h('span', { className: 'oe-media__thumb', 'aria-hidden': 'true' });
    const pick = iconButton({
        icon: 'library',
        label: `${opts.ariaLabel}: choose from library`,
        onClick: () => openMediaLibrary(field, { accept: opts.accept ?? ['image'] }),
    });
    const element = h('div', { className: `oe-media${opts.noThumb ? ' oe-media--no-thumb' : ''}` }, thumb, input, pick);
    const paint = (url: string) => {
        element.classList.toggle('oe-media--filled', !!url);
        thumb.style.backgroundImage = url && !opts.noThumb ? `url("${url.replace(/"/g, '%22')}")` : '';
    };
    const update = (url: string, media?: MediaSelection) => {
        paint(url);
        opts.onChange(url, media);
    };
    const off = onMediaSelected(field, (media) => {
        input.value = media.url;
        update(media.url, media);
    });
    paint(opts.value);
    return {
        element,
        destroy: off,
        setValue: (url) => {
            input.value = url;
            paint(url);
        },
    };
}

// ─────────────────────────────────────────────────────────────── Sortable list

export interface SortableRowApi {
    /** Index of this row at render time */
    index: number;
    /** Ask the list to re-render (after a change that affects other rows) */
    refresh: () => void;
}

/**
 * A reorderable list of cards with one drag handle, up/down for the keyboard, and a remove action
 * with inline confirmation when `confirmRemove` returns a message. Rows are rendered by the caller.
 */
export function sortableList<T>(opts: {
    items: T[];
    renderRow: (item: T, api: SortableRowApi) => HTMLElement;
    onChange: () => void;
    /** Return a message to ask first, or null to remove immediately */
    confirmRemove?: (item: T) => string | null;
    /** Keep at least this many rows; the remove action disables at the floor. Default 0. */
    min?: number;
    emptyText?: string;
    rowLabel?: (item: T, index: number) => string;
}): { element: HTMLElement; refresh: () => void } {
    const list = h('div', { className: 'oe-list', role: 'list' });
    let dragFrom: number | null = null;

    const move = (from: number, to: number) => {
        if (to < 0 || to >= opts.items.length || from === to) return;
        const [item] = opts.items.splice(from, 1);
        opts.items.splice(to, 0, item!);
        opts.onChange();
        refresh();
    };

    const refresh = () => {
        list.innerHTML = '';
        if (opts.items.length === 0 && opts.emptyText) {
            list.append(h('div', { className: 'oe-list__empty' }, opts.emptyText));
            return;
        }
        opts.items.forEach((item, index) => {
            const label = opts.rowLabel?.(item, index) ?? `Item ${index + 1}`;
            const atFloor = opts.items.length <= (opts.min ?? 0);
            const rowEl = h('div', {
                className: 'oe-list__row',
                role: 'listitem',
                draggable: 'true',
                dataset: { index: String(index) },
            });
            const handle = h('span', {
                className: 'oe-list__handle',
                title: 'Drag to reorder',
                'aria-hidden': 'true',
                html: icon('grip'),
            });
            const index1 = h('span', { className: 'oe-list__index', 'aria-hidden': 'true' }, String(index + 1));
            const body = h('div', { className: 'oe-list__body' }, opts.renderRow(item, { index, refresh }));
            const actions = h(
                'div',
                { className: 'oe-list__actions' },
                iconButton({
                    icon: 'up',
                    label: `Move ${label} up`,
                    disabled: index === 0,
                    onClick: () => move(index, index - 1),
                }),
                iconButton({
                    icon: 'down',
                    label: `Move ${label} down`,
                    disabled: index === opts.items.length - 1,
                    onClick: () => move(index, index + 1),
                }),
                iconButton({
                    icon: 'trash',
                    label: `Remove ${label}`,
                    danger: true,
                    disabled: atFloor,
                    onClick: async () => {
                        const message = opts.confirmRemove?.(item) ?? null;
                        if (message && !(await confirmInline(rowEl, message))) return;
                        opts.items.splice(index, 1);
                        opts.onChange();
                        refresh();
                    },
                }),
            );
            rowEl.append(handle, index1, body, actions);
            // Drag with the handle only; the inputs inside the row must keep text selection
            rowEl.addEventListener('dragstart', (e) => {
                if (
                    !(e.target as HTMLElement).closest('.oe-list__handle') &&
                    !(e.target as HTMLElement).classList.contains('oe-list__row')
                ) {
                    e.preventDefault();
                    return;
                }
                dragFrom = index;
                rowEl.classList.add('oe-list__row--dragging');
                e.dataTransfer?.setData('text/plain', String(index));
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
            });
            rowEl.addEventListener('dragend', () => rowEl.classList.remove('oe-list__row--dragging'));
            rowEl.addEventListener('dragover', (e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                rowEl.classList.add('oe-list__row--over');
            });
            rowEl.addEventListener('dragleave', () => rowEl.classList.remove('oe-list__row--over'));
            rowEl.addEventListener('drop', (e) => {
                e.preventDefault();
                rowEl.classList.remove('oe-list__row--over');
                if (dragFrom === null) return;
                const from = dragFrom;
                dragFrom = null;
                move(from, index);
            });
            // Only the handle starts a drag; a mousedown elsewhere turns dragging off for this press
            rowEl.addEventListener('mousedown', (e) => {
                rowEl.draggable = !!(e.target as HTMLElement).closest('.oe-list__handle');
            });
            rowEl.addEventListener('mouseup', () => {
                rowEl.draggable = true;
            });
            list.append(rowEl);
        });
    };
    refresh();
    return { element: list, refresh };
}
