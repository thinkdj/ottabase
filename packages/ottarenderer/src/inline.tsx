/**
 * Inline HTML → React, for the rich text Editor.js stores inside paragraphs, headings, list items,
 * captions and table cells.
 *
 * This is deliberately NOT a general HTML parser. It understands exactly the tags the editor's
 * inline tools emit (bold, italic, underline, strike, link, inline code, marker, annotation, line
 * break) and nothing else: an unknown tag is dropped and its text kept, a script or style element
 * is dropped with its contents, every URL goes through `sanitizeUrl`. Sanitising by allowlist
 * at parse time means stored content can never inject markup, and it runs anywhere React does,
 * including Workers, since it touches no DOM API.
 */
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { createElement, Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

export type InlineNode = string | { tag: string; attrs: Record<string, string>; children: InlineNode[] };

/** Tag → attributes kept. Anything not listed is dropped. */
const ALLOWED: Record<string, readonly string[]> = {
    a: ['href', 'target', 'title'],
    b: [],
    strong: [],
    i: [],
    em: [],
    u: [],
    s: [],
    del: [],
    sub: [],
    sup: [],
    kbd: [],
    br: [],
    code: ['class'],
    mark: ['class'],
    span: ['class', 'data-title', 'data-annotation'],
};
const VOID = new Set(['br']);
/** Elements whose text content must disappear with them */
const DROP_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'svg', 'math']);

const ENTITIES: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    hellip: '…',
    mdash: '—',
    ndash: '–',
    lsquo: '‘',
    rsquo: '’',
    ldquo: '“',
    rdquo: '”',
    copy: '©',
    reg: '®',
    trade: '™',
    laquo: '«',
    raquo: '»',
    middot: '·',
    bull: '•',
    times: '×',
};

export function decodeEntities(text: string): string {
    if (text.indexOf('&') === -1) return text;
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
        if (body[0] === '#') {
            const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
            return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
        }
        return ENTITIES[body.toLowerCase()] ?? whole;
    });
}

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
const ATTR_RE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function parseAttrs(raw: string, allowed: readonly string[]): Record<string, string> {
    const attrs: Record<string, string> = {};
    if (!raw || allowed.length === 0) return attrs;
    for (const m of raw.matchAll(ATTR_RE)) {
        const name = m[1]!.toLowerCase();
        if (allowed.includes(name)) attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
    }
    return attrs;
}

/** Parse the editor's inline HTML into a tree of allowed elements and text. */
export function parseInline(input: string | number | null | undefined): InlineNode[] {
    if (input === null || input === undefined || input === '') return [];
    // A table cell may hold a bare number. Comments are not tags to this parser, so strip them first
    // or they would surface as literal text.
    const html = (typeof input === 'string' ? input : String(input)).replace(/<!--[\s\S]*?-->/g, '');
    const root: InlineNode[] = [];
    const stack: Array<{ tag: string; children: InlineNode[] }> = [{ tag: '', children: root }];
    let last = 0;
    let dropUntil: string | null = null;
    TAG_RE.lastIndex = 0;
    for (const m of html.matchAll(TAG_RE)) {
        const [whole, slash, rawTag, rawAttrs] = m;
        const tag = rawTag!.toLowerCase();
        const text = html.slice(last, m.index);
        last = m.index! + whole.length;
        if (dropUntil) {
            if (slash && tag === dropUntil) dropUntil = null;
            continue;
        }
        if (text) stack[stack.length - 1]!.children.push(decodeEntities(text));
        if (slash) {
            // Close the innermost open element of this tag, and anything left open inside it
            for (let at = stack.length - 1; at > 0; at--) {
                if (stack[at]!.tag === tag) {
                    stack.length = at;
                    break;
                }
            }
            continue;
        }
        if (DROP_CONTENT.has(tag)) {
            // <embed> is void and <svg/> may self-close: drop the tag alone, or the rest of the text would go with it.
            if (tag !== 'embed' && !whole.endsWith('/>')) dropUntil = tag;
            continue;
        }
        const allowed = ALLOWED[tag];
        if (!allowed) continue; // unknown tag: keep its text, lose the tag
        const node = { tag, attrs: parseAttrs(rawAttrs ?? '', allowed), children: [] as InlineNode[] };
        stack[stack.length - 1]!.children.push(node);
        if (!VOID.has(tag)) stack.push(node);
    }
    if (!dropUntil) {
        const tail = html.slice(last);
        if (tail) stack[stack.length - 1]!.children.push(decodeEntities(tail));
    }
    return root;
}

/** Plain text of a parsed tree, whitespace collapsed. */
export function nodesToText(nodes: InlineNode[]): string {
    const walk = (list: InlineNode[]): string =>
        list.map((n) => (typeof n === 'string' ? n : n.tag === 'br' ? ' ' : walk(n.children))).join('');
    return walk(nodes).replace(/\s+/g, ' ').trim();
}

/** Plain text of inline HTML, for alt text, aria labels and heading ids. */
export function inlineToText(html: string | number | null | undefined): string {
    return nodesToText(parseInline(html));
}

/**
 * A URL safe to put in `src` or `href`, or null. `sanitizeUrl` answers "#" for anything unsafe,
 * which is right for a link and wrong for an image or a frame; this turns that sentinel into null.
 */
export function safeUrl(url: unknown): string | null {
    if (typeof url !== 'string' || !url.trim()) return null;
    const safe = sanitizeUrl(url);
    return safe === '#' ? null : safe;
}

const SEMANTIC: Record<string, string> = { b: 'strong', i: 'em' };

function renderNode(node: InlineNode, key: number): ReactNode {
    if (typeof node === 'string') return node;
    const children = node.children.map(renderNode);
    switch (node.tag) {
        case 'br':
            return <br key={key} />;
        case 'a': {
            const href = sanitizeUrl(node.attrs.href);
            const blank = node.attrs.target === '_blank';
            return (
                <a
                    key={key}
                    href={href}
                    title={node.attrs.title}
                    target={blank ? '_blank' : undefined}
                    rel={blank ? 'noopener noreferrer' : undefined}
                    className="otta-link"
                >
                    {children}
                </a>
            );
        }
        case 'code':
            return (
                <code key={key} className="otta-inline-code">
                    {children}
                </code>
            );
        case 'mark':
            return (
                <mark key={key} className="otta-mark">
                    {children}
                </mark>
            );
        case 'u':
            return (
                <u key={key} className="otta-underline">
                    {children}
                </u>
            );
        case 'span':
            if (/\bcdx-spoiler\b/.test(node.attrs.class ?? '')) {
                return <InlineSpoiler key={key}>{children}</InlineSpoiler>;
            }
            if (node.attrs['data-annotation'] || node.attrs['data-title']) {
                return (
                    <Annotation
                        key={key}
                        title={node.attrs['data-title'] ?? ''}
                        note={node.attrs['data-annotation'] ?? ''}
                    >
                        {children}
                    </Annotation>
                );
            }
            return <Fragment key={key}>{children}</Fragment>;
        default:
            return createElement(SEMANTIC[node.tag] ?? node.tag, { key }, ...children);
    }
}

/** Render a parsed tree as React nodes. */
export function renderNodes(nodes: InlineNode[]): ReactNode {
    return nodes.length === 0 ? null : nodes.map(renderNode);
}

/** Render the editor's inline HTML as React nodes. */
export function renderInline(html: string | number | null | undefined): ReactNode {
    return renderNodes(parseInline(html));
}

/** Parse once per distinct string: a long post re-renders on every lightbox or spoiler toggle. */
export function useInline(html: string | number | null | undefined): InlineNode[] {
    return useMemo(() => parseInline(html), [html]);
}

export function Inline({ html }: { html: string | number | null | undefined }) {
    return <>{renderNodes(useInline(html))}</>;
}

/**
 * A few words hidden inside a sentence. Blurred and unselectable until the reader clicks, taps or
 * presses Enter; then it settles into a faint chip so it is still clear what was hidden. Click again
 * to hide. Screen readers hear "Spoiler, reveal" and only get the words once revealed.
 */
export function InlineSpoiler({ children }: { children: ReactNode }) {
    const [revealed, setRevealed] = useState(false);
    const toggle = () => setRevealed((v) => !v);
    return (
        <span
            className="otta-spoiler"
            data-state={revealed ? 'revealed' : 'hidden'}
            role="button"
            tabIndex={0}
            aria-expanded={revealed}
            aria-label={revealed ? undefined : 'Spoiler, reveal'}
            title={revealed ? 'Hide again' : 'Click to reveal'}
            onClick={toggle}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                }
            }}
        >
            <span className="otta-spoiler__text" aria-hidden={!revealed}>
                {children}
            </span>
        </span>
    );
}

/**
 * An annotated phrase: dotted underline, a note that opens on hover, focus or tap.
 * The note is in the DOM (hidden) so it is read by assistive tech and indexed.
 */
export function Annotation({ title, note, children }: { title: string; note: string; children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const id = useId();
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const show = () => {
        if (timer.current) clearTimeout(timer.current);
        setOpen(true);
    };
    const hide = () => {
        timer.current = setTimeout(() => setOpen(false), 120);
    };
    useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);
    return (
        <span
            className="otta-annotation"
            data-state={open ? 'open' : 'closed'}
            tabIndex={0}
            role="button"
            aria-expanded={open}
            aria-describedby={id}
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpen((v) => !v);
                }
            }}
        >
            {children}
            <span className="otta-annotation__note" role="tooltip" id={id} hidden={!open}>
                {title && <strong className="otta-annotation__title">{title}</strong>}
                {note && <span className="otta-annotation__text">{note}</span>}
            </span>
        </span>
    );
}
