/**
 * @ottabase/ottadate — DOM utility helpers
 *
 * Minimal helpers for creating and managing DOM elements without a framework.
 * Used internally by all picker components.
 */

/** Create an element with optional classes, attributes, and children */
export function el(
    tag: string,
    attrs?: Record<string, string> | null,
    ...children: (string | HTMLElement | null | undefined)[]
): HTMLElement {
    const element = document.createElement(tag);

    if (attrs) {
        for (const [key, value] of Object.entries(attrs)) {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else {
                element.setAttribute(key, value);
            }
        }
    }

    for (const child of children) {
        if (child == null) continue;
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else {
            element.appendChild(child);
        }
    }

    return element;
}

/** Shortcut: create a div with classes */
export function div(className: string, ...children: (string | HTMLElement | null | undefined)[]): HTMLElement {
    return el('div', { className }, ...children);
}

/** Shortcut: create a button with classes and text */
export function btn(className: string, text: string, onClick?: (e: MouseEvent) => void): HTMLButtonElement {
    const button = el('button', { className, type: 'button' }, text) as HTMLButtonElement;
    if (onClick) {
        button.addEventListener('click', onClick);
    }
    return button;
}

/** Shortcut: create a span with text */
export function span(className: string, text: string): HTMLElement {
    return el('span', { className }, text);
}

/** Remove all children of an element */
export function clearChildren(element: HTMLElement): void {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/** Set display of an element */
export function setVisible(element: HTMLElement, visible: boolean): void {
    element.style.display = visible ? '' : 'none';
}

/** Toggle a CSS class on an element */
export function toggleClass(element: HTMLElement, className: string, force?: boolean): void {
    element.classList.toggle(className, force);
}

/** Add click-outside listener that calls handler when clicking outside target */
export function onClickOutside(target: HTMLElement, handler: () => void): () => void {
    const listener = (e: MouseEvent) => {
        if (!target.contains(e.target as Node)) {
            handler();
        }
    };
    // Delay adding the listener to avoid the opening click triggering it
    requestAnimationFrame(() => {
        document.addEventListener('mousedown', listener);
    });
    return () => document.removeEventListener('mousedown', listener);
}

/** Add keyboard listener for Escape key */
export function onEscape(handler: () => void): () => void {
    const listener = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handler();
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
}

// ---------------------------------------------------------------------------
// SVG Icons (inline, no external deps)
// ---------------------------------------------------------------------------

/** Calendar icon SVG */
export function iconCalendar(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
}

/** Clock icon SVG */
export function iconClock(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
}

/** Chevron left SVG */
export function iconChevronLeft(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
}

/** Chevron right SVG */
export function iconChevronRight(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
}

/** X close icon SVG */
export function iconX(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
}
