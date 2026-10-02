import { describe, expect, it } from 'vitest';
import { inlineMarkdown, markdownToEditorJs, parseMarkdownPost, readBlogImportFile } from '../import-export';

const blocksOf = (markdown: string) => markdownToEditorJs(markdown).blocks.map(({ type, data }) => ({ type, data }));

describe('markdownToEditorJs', () => {
    it('maps block syntax onto the EditorJS blocks the editor and renderer use', () => {
        const blocks = blocksOf(
            [
                '## Getting started',
                '',
                'First line',
                'continues here.',
                '',
                '```ts',
                'const a = 1 * 2;',
                '```',
                '',
                '> Quoted',
                '> wisdom',
                '',
                '---',
                '',
                '![A cat](https://img.example/cat.png "Sleepy")',
                '',
                '1. one',
                '2. two',
            ].join('\n'),
        );

        expect(blocks).toEqual([
            { type: 'header', data: { text: 'Getting started', level: 2 } },
            { type: 'paragraph', data: { text: 'First line continues here.' } },
            { type: 'code', data: { code: 'const a = 1 * 2;', language: 'ts' } },
            { type: 'quote', data: { text: 'Quoted wisdom', caption: '' } },
            { type: 'delimiter', data: {} },
            { type: 'image', data: { url: 'https://img.example/cat.png', alt: 'A cat', caption: 'Sleepy' } },
            {
                type: 'list',
                data: {
                    style: 'ordered',
                    items: [
                        { content: 'one', items: [] },
                        { content: 'two', items: [] },
                    ],
                },
            },
        ]);
    });

    it('nests indented list items and keeps loose lists together', () => {
        const [list] = blocksOf(['- fruit', '  - apple', '', '- veg'].join('\n'));
        expect(list).toEqual({
            type: 'list',
            data: {
                style: 'unordered',
                items: [
                    { content: 'fruit', items: [{ content: 'apple', items: [] }] },
                    { content: 'veg', items: [] },
                ],
            },
        });
    });

    it('keeps a trailing hash that belongs to the heading text', () => {
        expect(blocksOf('# Learn C#')[0].data.text).toBe('Learn C#');
    });

    it('drops images with unsafe URLs', () => {
        expect(blocksOf('![x](javascript:alert(1))')).toEqual([]);
    });
});

describe('inlineMarkdown', () => {
    it('converts emphasis, code, and links to EditorJS inline HTML', () => {
        expect(inlineMarkdown('**bold** *it* `a_b` [site](https://x.test/?a=1&b=2)')).toBe(
            '<b>bold</b> <i>it</i> <code>a_b</code> <a href="https://x.test/?a=1&amp;b=2">site</a>',
        );
    });

    it('escapes raw HTML and refuses script URLs', () => {
        expect(inlineMarkdown('<img src=x onerror=alert(1)> [x](javascript:alert(1))')).toBe(
            '&lt;img src=x onerror=alert(1)&gt; x',
        );
    });

    it('leaves identifiers with underscores alone', () => {
        expect(inlineMarkdown('set snake_case_name to _x_')).toBe('set snake_case_name to <i>x</i>');
    });

    it('keeps balanced parentheses inside link URLs', () => {
        expect(inlineMarkdown('[Foo](https://en.wikipedia.org/wiki/Foo_(bar)) after')).toBe(
            '<a href="https://en.wikipedia.org/wiki/Foo_(bar)">Foo</a> after',
        );
    });
});

describe('parseMarkdownPost', () => {
    it('reads common front matter aliases', () => {
        const post = parseMarkdownPost(
            [
                '---',
                'title: "Kyoto in the rain"',
                'date: 2019-05-12',
                'tags: [travel, japan]',
                'categories:',
                '  - Journal',
                'description: Blue hour.',
                'cover_image: https://img.example/kyoto.jpg',
                'draft: true',
                '---',
                'Body text.',
            ].join('\n'),
            'kyoto.md',
        );

        expect(post).toMatchObject({
            title: 'Kyoto in the rain',
            slug: 'kyoto',
            status: 'draft',
            excerpt: 'Blue hour.',
            publishedAt: Date.parse('2019-05-12'),
            tags: ['travel', 'japan'],
            categories: ['Journal'],
            heroImage: { url: 'https://img.example/kyoto.jpg', alt: 'Kyoto in the rain' },
        });
        expect(post.content?.blocks).toEqual([{ type: 'paragraph', data: { text: 'Body text.' } }]);
    });

    it('takes the title from a leading heading and slug/date from a Jekyll filename', () => {
        const post = parseMarkdownPost('# Hello world\n\nBody.', '_posts/2020-01-31-hello-world.md');
        expect(post).toMatchObject({
            title: 'Hello world',
            slug: 'hello-world',
            status: 'published',
            publishedAt: Date.parse('2020-01-31'),
        });
        expect(post.content?.blocks).toHaveLength(1);
    });

    it('treats Jekyll `published: false` as a draft and ignores index filenames as slugs', () => {
        const post = parseMarkdownPost('---\ntitle: Bundle\npublished: false\n---\n', 'posts/bundle/index.md');
        expect(post.status).toBe('draft');
        expect(post.slug).toBeUndefined();
    });
});

describe('readBlogImportFile', () => {
    it('accepts an ottablog export and rejects other JSON', () => {
        const file = JSON.stringify({ format: 'ottablog', version: 1, exportedAt: '', posts: [{ title: 'A' }] });
        expect(readBlogImportFile(file, 'blog.json')).toEqual([{ title: 'A' }]);
        expect(() => readBlogImportFile('{"posts":[]}', 'other.json')).toThrow(/not an ottablog export/);
        expect(() => readBlogImportFile('nope', 'bad.json')).toThrow(/not valid JSON/);
        expect(() => readBlogImportFile('x', 'notes.txt')).toThrow(/only .json exports and .md files/);
    });
});
