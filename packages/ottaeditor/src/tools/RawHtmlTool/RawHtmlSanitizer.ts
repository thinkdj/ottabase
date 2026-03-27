const WRAPPER_TAG_PATTERN = /<\/?(?:!doctype|html|head|body)\b[^>]*>/gi;

const BLOCKED_TAGS = new Set([
    'script',
    'style',
    'iframe',
    'frame',
    'frameset',
    'object',
    'embed',
    'applet',
    'meta',
    'base',
    'link',
    'noscript',
    'form',
    'input',
    'button',
    'select',
    'option',
    'textarea',
]);

const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'formaction']);

function isDangerousProtocol(value: string): boolean {
    const normalized = value.replace(/[\u0000-\u001F\u007F\s]+/g, '').toLowerCase();
    return normalized.startsWith('javascript:') || normalized.startsWith('vbscript:') || normalized.startsWith('data:');
}

function sanitizeElementAttributes(el: Element): void {
    const attributes = [...el.attributes];

    for (const attribute of attributes) {
        const attrName = attribute.name.toLowerCase();
        const attrValue = attribute.value.trim();

        // Remove inline event handlers and style attributes from raw HTML blocks.
        if (attrName.startsWith('on') || attrName === 'style' || attrName === 'srcdoc') {
            el.removeAttribute(attribute.name);
            continue;
        }

        // Remove URI attributes that can execute script-like payloads.
        if (URL_ATTRS.has(attrName) && isDangerousProtocol(attrValue)) {
            el.removeAttribute(attribute.name);
        }
    }

    // Harden links that open in a new tab.
    if (el.tagName.toLowerCase() === 'a') {
        const target = el.getAttribute('target');
        if (target?.toLowerCase() === '_blank') {
            el.setAttribute('rel', 'noopener noreferrer');
        }
    }
}

function removeBlockedTags(root: Element): void {
    if (BLOCKED_TAGS.size === 0) return;

    const selector = [...BLOCKED_TAGS].join(',');
    root.querySelectorAll(selector).forEach((node) => node.remove());
}

export function sanitizeRawHtml(input: string): string {
    const cleanedInput = (input || '').replace(WRAPPER_TAG_PATTERN, '').trim();
    if (!cleanedInput) return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${cleanedInput}</div>`, 'text/html');
    const root = doc.body.firstElementChild;

    if (!root) return '';

    removeBlockedTags(root);

    for (const element of root.querySelectorAll('*')) {
        const tagName = element.tagName.toLowerCase();
        if (BLOCKED_TAGS.has(tagName)) {
            element.remove();
            continue;
        }

        sanitizeElementAttributes(element);
    }

    return root.innerHTML.trim();
}
