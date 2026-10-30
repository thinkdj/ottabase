import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { decodeEntities, Inline, inlineToText, parseInline } from '../inline';

describe('parseInline', () => {
    it('keeps the editor inline tools and their attributes', () => {
        const tree = parseInline(
            'Hi <b>bold</b> <a href="https://x.io" target="_blank">x</a> <code class="inline-code">c</code>',
        );
        expect(tree).toEqual([
            'Hi ',
            { tag: 'b', attrs: {}, children: ['bold'] },
            ' ',
            { tag: 'a', attrs: { href: 'https://x.io', target: '_blank' }, children: ['x'] },
            ' ',
            { tag: 'code', attrs: { class: 'inline-code' }, children: ['c'] },
        ]);
    });

    it('drops unknown tags but keeps their text, and drops scripts with their contents', () => {
        expect(parseInline('a <div onclick="x()">b</div> c<script>evil()</script>d')).toEqual(['a ', 'b', ' c', 'd']);
        expect(parseInline('<img src=x onerror=alert(1)>text')).toEqual(['text']);
    });

    it('strips HTML comments instead of showing them as text', () => {
        expect(parseInline('a<!-- hidden <b>x</b> -->b')).toEqual(['ab']);
    });

    it('drops disallowed attributes', () => {
        const [a] = parseInline('<a href="/p" onclick="x()" style="color:red">p</a>') as Array<{
            attrs: Record<string, string>;
        }>;
        expect(a!.attrs).toEqual({ href: '/p' });
    });

    it('closes the innermost of nested same-name tags', () => {
        expect(parseInline('<b>a<b>c</b>d</b>')).toEqual([
            { tag: 'b', attrs: {}, children: ['a', { tag: 'b', attrs: {}, children: ['c'] }, 'd'] },
        ]);
    });

    it('accepts a bare number, as a table cell may hold one', () => {
        expect(parseInline(42 as unknown as string)).toEqual(['42']);
        expect(inlineToText(3.5)).toBe('3.5');
    });

    it('recovers from unclosed and mis-nested tags', () => {
        expect(parseInline('<b>bold <i>both</b> tail')).toEqual([
            { tag: 'b', attrs: {}, children: ['bold ', { tag: 'i', attrs: {}, children: ['both'] }] },
            ' tail',
        ]);
        expect(parseInline('plain</b> text')).toEqual(['plain', ' text']);
    });

    it('decodes entities', () => {
        expect(decodeEntities('a&nbsp;&amp;&lt;b&gt; &#169; &#x263A; &bogus;')).toBe('a &<b> © ☺ &bogus;');
        expect(parseInline('Tom &amp; Jerry')).toEqual(['Tom & Jerry']);
    });

    it('inlineToText strips markup and collapses whitespace', () => {
        expect(inlineToText('  <b>Hello</b><br>world&nbsp; ')).toBe('Hello world');
        expect(inlineToText(undefined)).toBe('');
    });
});

describe('Inline', () => {
    it('renders semantic elements and safe links', () => {
        const { container } = render(
            <p>
                <Inline html='<b>b</b> <i>i</i> <u class="cdx-underline">u</u> <mark class="cdx-marker">m</mark> <a href="javascript:alert(1)">bad</a> <a href="https://ok.io" target="_blank">ok</a><br>next' />
            </p>,
        );
        expect(container.querySelector('strong')?.textContent).toBe('b');
        expect(container.querySelector('em')?.textContent).toBe('i');
        expect(container.querySelector('u.otta-underline')).toBeTruthy();
        expect(container.querySelector('mark.otta-mark')).toBeTruthy();
        expect(container.querySelector('br')).toBeTruthy();
        const links = container.querySelectorAll('a');
        expect(links[0]?.getAttribute('href')).toBe('#');
        expect(links[1]?.getAttribute('rel')).toBe('noopener noreferrer');
        expect(links[1]?.getAttribute('target')).toBe('_blank');
    });

    it('turns an annotation span into a toggleable note', () => {
        render(
            <p>
                <Inline html='A <span class="cdx-annotation" data-title="Term" data-annotation="Meaning">word</span>.' />
            </p>,
        );
        const trigger = screen.getByRole('button', { expanded: false });
        expect(trigger.textContent).toContain('word');
        const note = screen.getByRole('tooltip', { hidden: true });
        expect(note.hidden).toBe(true);
        fireEvent.click(trigger);
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(note.hidden).toBe(false);
        expect(note.textContent).toContain('Term');
        expect(note.textContent).toContain('Meaning');
        fireEvent.keyDown(trigger, { key: 'Escape' });
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
});
