import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { BlockList, blockRenderers, hasBlocks, HtmlRenderer, OttaRenderer } from '../index';

vi.mock('@ottabase/medialibrary/react', () => ({
    MediaPreview: () => null,
    useMediaLightboxRegistration: () => ({ open: () => undefined, isEnabled: false }),
}));

describe('OttaRenderer', () => {
    it('wraps every block, keyed by id, with slot and type hooks', () => {
        const { container } = render(
            <OttaRenderer
                as="article"
                className="extra"
                data={{
                    blocks: [
                        { id: 'a', type: 'header', data: { text: 'Title', level: 2 } },
                        { id: 'b', type: 'paragraph', data: { text: 'Body <b>bold</b>' } },
                        { id: 'c', type: 'mystery', data: {} },
                    ],
                }}
            />,
        );
        const root = container.firstElementChild!;
        expect(root.tagName).toBe('ARTICLE');
        expect(root.className).toBe('ottarenderer extra');
        expect(root.getAttribute('data-slot')).toBe('renderer');
        const blocks = root.querySelectorAll('[data-slot="block"]');
        expect(blocks.length).toBe(2); // unknown types are skipped
        expect(blocks[0]?.className).toBe('otta-block otta-block--header');
        expect(blocks[1]?.getAttribute('data-block')).toBe('paragraph');
        expect(screen.getByText('bold').tagName).toBe('STRONG');
    });

    it('survives hostile or malformed input: prototype keys, duplicate ids, non-array blocks, NaN levels', () => {
        const { container } = render(
            <OttaRenderer
                data={{
                    blocks: [
                        { id: 'dup', type: 'constructor', data: {} },
                        { id: 'dup', type: 'paragraph', data: { text: 'a' } },
                        { id: 'dup', type: 'paragraph', data: { text: 'b' } },
                        { type: 'header', data: { text: 'H', level: 'nope' as unknown as number } },
                        { type: 'table', data: { content: [[1, 2]] as unknown as string[][] } },
                    ],
                }}
            />,
        );
        expect(container.querySelectorAll('[data-slot=block]').length).toBe(4);
        expect(container.querySelector('h2')?.id).toBe('h');
        expect(container.querySelector('h2')?.textContent).toBe('H'); // the anchor glyph is CSS, not text
        expect(container.querySelector('td')?.textContent).toBe('1');
        const { container: bad } = render(<OttaRenderer data={{ blocks: 'nope' as unknown as [] }} />);
        expect(bad.querySelector('[data-slot=block]')).toBeNull();
    });

    it('renders nothing for missing data and reports hasBlocks', () => {
        const { container } = render(<OttaRenderer data={null} />);
        expect(container.querySelector('[data-slot="block"]')).toBeNull();
        expect(hasBlocks(null)).toBe(false);
        expect(hasBlocks({ blocks: [] })).toBe(false);
        expect(hasBlocks({ blocks: [{ type: 'paragraph', data: {} }] })).toBe(true);
    });

    it('places injections before their index and trailing ones at the end', () => {
        const { container } = render(
            <OttaRenderer
                data={{
                    blocks: [
                        { type: 'paragraph', data: { text: 'one' } },
                        { type: 'paragraph', data: { text: 'two' } },
                    ],
                }}
                injections={[
                    { index: 1, component: <aside>Ad</aside> },
                    { index: 99, component: <aside>Related</aside> },
                ]}
            />,
        );
        const texts = [...container.querySelectorAll('[data-slot="block"]')].map((el) => el.textContent);
        expect(texts).toEqual(['one', 'Ad', 'two', 'Related']);
        expect(container.querySelector('[data-block="injection"]')).toBeTruthy();
    });

    it('lets a consumer replace or add a renderer', () => {
        const renderers = {
            ...blockRenderers,
            paragraph: ({ data }: { data: { text?: string } }) => <q>{data.text}</q>,
            shout: ({ data }: { data: { t: string } }) => <b>{data.t.toUpperCase()}</b>,
        };
        const { container } = render(
            <OttaRenderer
                renderers={renderers}
                data={{
                    blocks: [
                        { type: 'paragraph', data: { text: 'p' } },
                        { type: 'shout', data: { t: 'hey' } },
                    ],
                }}
            />,
        );
        expect(container.querySelector('q')?.textContent).toBe('p');
        expect(container.querySelector('b')?.textContent).toBe('HEY');
    });
});

describe('standard blocks', () => {
    const one = (type: string, data: Record<string, unknown>) =>
        render(<OttaRenderer data={{ blocks: [{ type, data }] }} />).container;

    it('header: level clamp, slug id, anchor', () => {
        const c = one('header', { text: 'Hello <i>World</i>!', level: 9 });
        const h = c.querySelector('h6')!;
        expect(h.id).toBe('hello-world');
        expect(h.querySelector('em')?.textContent).toBe('World');
        expect(h.querySelector('a.otta-heading__anchor')?.getAttribute('href')).toBe('#hello-world');
    });

    it('paragraph: empty text keeps its line', () => {
        expect(one('paragraph', { text: '' }).querySelector('p.otta-paragraph--empty')).toBeTruthy();
        expect(one('paragraph', { text: 'x' }).querySelector('p.otta-paragraph--empty')).toBeNull();
    });

    it('list: all three payload shapes, nesting, ordered start and checklist', () => {
        const nested = one('list', {
            style: 'ordered',
            items: [{ content: 'A', items: [{ content: 'A1', items: [] }] }],
        });
        expect(nested.querySelector('ol.otta-list--ordered > li > ol[data-depth="2"] li')?.textContent).toBe('A1');
        const legacy = one('list', { style: 'unordered', items: ['x', 'y'] });
        expect(legacy.querySelectorAll('ul > li').length).toBe(2);
        const v2 = one('list', {
            style: 'checklist',
            meta: {},
            items: [{ content: 'done', meta: { checked: true }, items: [] }],
        });
        expect(v2.querySelector('li[data-checked="true"] .otta-check[data-checked="true"]')).toBeTruthy();
        const start = one('list', {
            style: 'ordered',
            meta: { start: 4, counterType: 'lower-alpha' },
            items: [{ content: 'd' }],
        });
        expect(start.querySelector('ol')?.getAttribute('start')).toBe('4');
        expect((start.querySelector('ol') as HTMLElement).style.listStyleType).toBe('lower-alpha');
    });

    it('checklist: done items are marked and announced', () => {
        const c = one('checklist', {
            items: [
                { text: 'a <b>b</b>', checked: true },
                { text: 'c', checked: false },
            ],
        });
        expect(c.querySelectorAll('li[data-checked="true"]').length).toBe(1);
        expect(c.querySelector('.otta-sr-only')?.textContent).toBe('Done: ');
        expect(c.querySelector('li strong')?.textContent).toBe('b');
    });

    it('quote: text, caption and alignment', () => {
        const c = one('quote', { text: 'Be <b>kind</b>', caption: 'Someone', alignment: 'center' });
        expect(c.querySelector('blockquote')?.getAttribute('data-align')).toBe('center');
        expect(c.querySelector('cite')?.textContent).toBe('Someone');
        expect(c.querySelector('.otta-quote__text strong')).toBeTruthy();
    });

    it('delimiter: style and line width', () => {
        expect(one('delimiter', {}).querySelector('hr.otta-delimiter--star')).toBeTruthy();
        const hr = one('delimiter', { style: 'line', lineWidth: 40 }).querySelector('hr') as HTMLElement;
        expect(hr.className).toContain('otta-delimiter--line');
        expect(hr.style.width).toBe('40%');
    });

    it('table: stretched flag reaches the wrapper', () => {
        expect(
            one('table', { stretched: true, content: [['a']] })
                .querySelector('.otta-table-wrap')
                ?.getAttribute('data-stretched'),
        ).toBe('true');
        expect(
            one('table', { content: [['a']] })
                .querySelector('.otta-table-wrap')
                ?.hasAttribute('data-stretched'),
        ).toBe(false);
    });

    it('image: intrinsic size, lazy loading, legacy file.url and aspect class', () => {
        const c = one('image', {
            url: 'https://x.io/p.jpg',
            width: 1200,
            height: 800,
            caption: 'Cap',
            aspectRatio: '16:9',
        });
        const img = c.querySelector('img')!;
        expect(img.getAttribute('width')).toBe('1200');
        expect(img.getAttribute('height')).toBe('800');
        expect(img.getAttribute('loading')).toBe('lazy');
        expect(img.className).toContain('aspect-video');
        expect(c.querySelector('figure')?.className).toContain('otta-image--aspect-16-9');
        expect(c.querySelector('figcaption')?.textContent).toBe('Cap');
        expect(
            one('image', { file: { url: 'https://x.io/legacy.png' } })
                .querySelector('img')
                ?.getAttribute('src'),
        ).toBe('https://x.io/legacy.png');
    });

    it('steps: textarea content stays text, never markup', () => {
        const c = one('steps', { items: [{ title: 'T', content: 'a <b>b</b>\nline two' }] });
        expect(c.querySelector('.otta-steps-text b')).toBeNull();
        expect(c.querySelector('.otta-steps-text')?.textContent).toContain('<b>b</b>');
    });

    it('table: headings, padded rows and inline formatting', () => {
        const c = one('table', { withHeadings: true, content: [['A', 'B'], ['<b>1</b>'], ['3', '4']] });
        expect(c.querySelectorAll('th[scope="col"]').length).toBe(2);
        expect(c.querySelectorAll('tbody tr').length).toBe(2);
        expect(c.querySelectorAll('tbody tr')[0]?.querySelectorAll('td').length).toBe(2);
        expect(c.querySelector('td strong')?.textContent).toBe('1');
    });

    it('embed: lazy iframe with the stored aspect ratio and a caption', () => {
        const c = one('embed', {
            service: 'youtube',
            source: 'https://youtu.be/x',
            embed: 'https://www.youtube.com/embed/x',
            width: 580,
            height: 320,
            caption: 'Clip',
        });
        const frame = c.querySelector('iframe')!;
        expect(frame.getAttribute('src')).toBe('https://www.youtube.com/embed/x');
        expect(frame.getAttribute('loading')).toBe('lazy');
        expect(frame.getAttribute('title')).toBe('Clip');
        expect((c.querySelector('.otta-embed__frame') as HTMLElement).style.aspectRatio).toBe('580 / 320');
        expect(c.querySelector('figcaption')?.textContent).toBe('Clip');
    });

    it('linkTool: preview card with host, and nothing for an unsafe link', () => {
        const c = one('linkTool', {
            link: 'https://www.example.com/post',
            meta: { title: 'Post', description: 'About', image: { url: 'https://example.com/i.png' } },
        });
        const card = c.querySelector('a.otta-link-card')!;
        expect(card.getAttribute('href')).toBe('https://www.example.com/post');
        expect(card.querySelector('.otta-link-card__host')?.textContent).toBe('example.com');
        expect(card.querySelector('img')?.getAttribute('src')).toBe('https://example.com/i.png');
        expect(one('linkTool', { link: 'javascript:alert(1)' }).querySelector('a')).toBeNull();
    });

    it('embed: an unsafe embed URL never becomes a frame; the source link is shown instead', () => {
        const c = one('embed', { service: 'x', source: 'https://a.b/c', embed: 'javascript:alert(1)' });
        expect(c.querySelector('iframe')).toBeNull();
        expect(c.querySelector('a.otta-link')?.getAttribute('href')).toBe('https://a.b/c');
        expect(one('embed', { embed: 'javascript:alert(1)' }).querySelector('[data-slot=block]')?.textContent).toBe('');
    });

    it('header: a null level falls back to h2, not h1', () => {
        expect(one('header', { text: 'S', level: null as unknown as number }).querySelector('h2')).toBeTruthy();
        expect(one('header', { text: 'S', level: 0 }).querySelector('h2')).toBeTruthy();
    });

    it('images: javascript: and data: sources are dropped everywhere', () => {
        expect(one('image', { url: 'javascript:alert(1)' }).querySelector('img')).toBeNull();
        expect(
            one('beforeAfter', { beforeUrl: 'javascript:x', afterUrl: 'data:text/html,x' }).querySelector('img'),
        ).toBeNull();
        expect(one('imageHotspots', { imageUrl: '//evil.io/x.png', hotspots: [] }).querySelector('img')).toBeNull();
        const t = one('testimonial', {
            quote: 'q',
            authorName: 'a',
            authorAvatar: 'javascript:x',
            companyLogo: 'data:x',
        });
        expect(t.querySelector('img')).toBeNull();
    });

    it('heading ids are stable when a header is memoised and the root re-renders', () => {
        const Memo = React.memo(blockRenderers.header!);
        const data = {
            blocks: [
                { id: 'a', type: 'header', data: { text: 'Same', level: 2 } },
                { id: 'b', type: 'header', data: { text: 'Same', level: 3 } },
            ],
        };
        const { container, rerender } = render(
            <OttaRenderer data={data} renderers={{ ...blockRenderers, header: Memo }} />,
        );
        rerender(<OttaRenderer data={data} renderers={{ ...blockRenderers, header: Memo }} className="x" />);
        expect(container.querySelector('h2')?.id).toBe('same');
        expect(container.querySelector('h3')?.id).toBe('same-2');
    });

    it('BlockList works standalone with the built-in renderers', () => {
        const { container } = render(<BlockList blocks={[{ type: 'paragraph', data: { text: 'solo' } }]} />);
        expect(container.querySelector('p.otta-paragraph')?.textContent).toBe('solo');
    });

    it('warning: title and message with inline formatting', () => {
        const c = one('warning', { title: 'Heads <b>up</b>', message: 'Careful' });
        expect(c.querySelector('.otta-warning__title strong')?.textContent).toBe('up');
        expect(c.querySelector('.otta-warning__text')?.textContent).toBe('Careful');
    });

    it('raw: sanitized HTML', () => {
        const c = one('raw', { html: '<p>ok</p><script>bad()</script>' });
        expect(c.querySelector('.otta-raw p')?.textContent).toBe('ok');
        expect(c.querySelector('script')).toBeNull();
    });
});

describe('HtmlRenderer', () => {
    it('sanitizes and carries the renderer typography class', () => {
        const { container } = render(
            <HtmlRenderer content='<h2>T</h2><p onclick="x()">p</p><script>x()</script>' className="mine" />,
        );
        const root = container.firstElementChild!;
        expect(root.className).toBe('ottarenderer ottarenderer--html mine');
        expect(root.querySelector('h2')?.textContent).toBe('T');
        expect(root.querySelector('p')?.getAttribute('onclick')).toBeNull();
        expect(root.querySelector('script')).toBeNull();
    });
});
