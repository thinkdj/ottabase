import { describe, expect, it } from 'vitest';
import { exportToJSON, exportToMarkdown, convertInlineHTML } from '../export';
import type { OutputData } from '@editorjs/editorjs';

describe('Export Utilities', () => {
    describe('exportToJSON', () => {
        it('should return pretty-printed JSON', () => {
            const data: OutputData = {
                time: 1234567890,
                blocks: [{ id: '1', type: 'paragraph', data: { text: 'Hello' } }],
                version: '2.30.0',
            };
            const json = exportToJSON(data);
            expect(json).toBe(JSON.stringify(data, null, 2));
            expect(json).toContain('\n');
        });

        it('should handle empty blocks', () => {
            const data: OutputData = { time: 0, blocks: [], version: '2.30.0' };
            const json = exportToJSON(data);
            expect(JSON.parse(json).blocks).toEqual([]);
        });
    });

    describe('convertInlineHTML', () => {
        it('should convert bold tags', () => {
            expect(convertInlineHTML('<b>bold</b>')).toBe('**bold**');
            expect(convertInlineHTML('<strong>bold</strong>')).toBe('**bold**');
        });

        it('should convert italic tags', () => {
            expect(convertInlineHTML('<i>italic</i>')).toBe('*italic*');
            expect(convertInlineHTML('<em>italic</em>')).toBe('*italic*');
        });

        it('should convert links', () => {
            expect(convertInlineHTML('<a href="https://example.com">link</a>')).toBe('[link](https://example.com)');
        });

        it('should convert code tags', () => {
            expect(convertInlineHTML('<code>code</code>')).toBe('`code`');
        });

        it('should convert mark tags', () => {
            expect(convertInlineHTML('<mark>highlighted</mark>')).toBe('==highlighted==');
        });

        it('should keep underline as HTML', () => {
            expect(convertInlineHTML('<u>underlined</u>')).toBe('<u>underlined</u>');
        });

        it('should strip unknown HTML tags', () => {
            expect(convertInlineHTML('<span>text</span>')).toBe('text');
            expect(convertInlineHTML('<div>text</div>')).toBe('text');
        });

        it('should handle empty string', () => {
            expect(convertInlineHTML('')).toBe('');
        });

        it('should convert br tags to newlines', () => {
            expect(convertInlineHTML('line1<br>line2')).toBe('line1\nline2');
            expect(convertInlineHTML('line1<br/>line2')).toBe('line1\nline2');
        });

        it('should handle nested formatting', () => {
            const result = convertInlineHTML('<b><i>bold-italic</i></b>');
            expect(result).toBe('***bold-italic***');
        });
    });

    describe('exportToMarkdown', () => {
        it('should return empty string for empty data', () => {
            expect(exportToMarkdown({ time: 0, blocks: [], version: '' })).toBe('');
        });

        it('should convert paragraph blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [{ id: '1', type: 'paragraph', data: { text: 'Hello <b>world</b>' } }],
                version: '',
            };
            expect(exportToMarkdown(data)).toBe('Hello **world**');
        });

        it('should convert header blocks at various levels', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    { id: '1', type: 'header', data: { text: 'Title', level: 1 } },
                    { id: '2', type: 'header', data: { text: 'Subtitle', level: 3 } },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('# Title');
            expect(md).toContain('### Subtitle');
        });

        it('should convert unordered list blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'list',
                        data: { style: 'unordered', items: ['Item 1', 'Item 2'] },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('- Item 1');
            expect(md).toContain('- Item 2');
        });

        it('should convert ordered list blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'list',
                        data: { style: 'ordered', items: ['First', 'Second'] },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('1. First');
            expect(md).toContain('2. Second');
        });

        it('should convert nested list blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'nestedList',
                        data: {
                            style: 'unordered',
                            items: [
                                {
                                    content: 'Parent',
                                    items: [{ content: 'Child', items: [] }],
                                },
                            ],
                        },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('- Parent');
            expect(md).toContain('  - Child');
        });

        it('should convert checklist blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'checklist',
                        data: {
                            items: [
                                { text: 'Done', checked: true },
                                { text: 'Todo', checked: false },
                            ],
                        },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('- [x] Done');
            expect(md).toContain('- [ ] Todo');
        });

        it('should convert code blocks with language', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'code',
                        data: { code: 'const x = 1;', languageCode: 'javascript' },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('```javascript');
            expect(md).toContain('const x = 1;');
            expect(md).toContain('```');
        });

        it('should convert quote blocks with caption', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'quote',
                        data: { text: 'To be or not to be', caption: 'Shakespeare' },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('> To be or not to be');
            expect(md).toContain('— Shakespeare');
        });

        it('should convert delimiter blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [{ id: '1', type: 'delimiter', data: {} }],
                version: '',
            };
            expect(exportToMarkdown(data)).toBe('---');
        });

        it('should convert table blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'table',
                        data: {
                            content: [
                                ['Name', 'Age'],
                                ['Alice', '30'],
                            ],
                        },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('| Name | Age |');
            expect(md).toContain('| --- | --- |');
            expect(md).toContain('| Alice | 30 |');
        });

        it('should convert warning blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'warning',
                        data: { title: 'Warning', message: 'Be careful' },
                    },
                ],
                version: '',
            };
            expect(exportToMarkdown(data)).toContain('> ⚠️ **Warning**: Be careful');
        });

        it('should convert image blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'image',
                        data: { file: { url: 'https://example.com/img.png' }, caption: 'My image' },
                    },
                ],
                version: '',
            };
            expect(exportToMarkdown(data)).toContain('![My image](https://example.com/img.png "My image")');
        });

        it('should convert embed blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'embed',
                        data: { source: 'https://youtube.com/watch?v=123', caption: 'Video' },
                    },
                ],
                version: '',
            };
            expect(exportToMarkdown(data)).toContain('[Video](https://youtube.com/watch?v=123)');
        });

        it('should convert raw blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'raw',
                        data: { html: '<div>custom</div>' },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('<!-- raw html -->');
            expect(md).toContain('<div>custom</div>');
        });

        it('should convert spoiler blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'spoiler',
                        data: { title: 'Click me', content: 'Hidden text' },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('<details>');
            expect(md).toContain('<summary>Click me</summary>');
            expect(md).toContain('Hidden text');
        });

        it('should convert CTA blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'cta',
                        data: { text: 'Sign Up', url: 'https://example.com/signup' },
                    },
                ],
                version: '',
            };
            expect(exportToMarkdown(data)).toBe('[Sign Up](https://example.com/signup)');
        });

        it('should convert review blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'review',
                        data: { title: 'Great Product', rating: 4, summary: 'Loved it' },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('### Great Product');
            expect(md).toContain('★★★★☆');
            expect(md).toContain('Loved it');
        });

        it('should convert FAQ blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'faq',
                        data: {
                            items: [{ question: 'Why?', answer: 'Because.' }],
                        },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('**Q:** Why?');
            expect(md).toContain('**A:** Because.');
        });

        it('should convert testimonial blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'testimonial',
                        data: {
                            quote: 'Amazing product',
                            authorName: 'Jane Doe',
                            authorRole: 'CEO',
                            rating: 5,
                        },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('> Amazing product');
            expect(md).toContain('**Jane Doe**');
            expect(md).toContain('★★★★★');
        });

        it('should convert steps blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'steps',
                        data: {
                            items: [
                                { title: 'Step One', content: 'Do this' },
                                { title: 'Step Two', content: '' },
                            ],
                        },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('1. **Step One** — Do this');
            expect(md).toContain('2. **Step Two**');
        });

        it('should convert disclosure blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'disclosure',
                        data: {
                            aiEnabled: true,
                            aiLevel: 'mid',
                            sponsoredEnabled: false,
                        },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('[^ai]:');
            expect(md).toContain('significantly used');
        });

        it('should convert map blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'map',
                        data: { url: 'https://maps.google.com/123' },
                    },
                ],
                version: '',
            };
            expect(exportToMarkdown(data)).toBe('[View Map](https://maps.google.com/123)');
        });

        it('should convert mediaEmbed blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'mediaEmbed',
                        data: { url: 'https://example.com/video.mp4', title: 'My Video' },
                    },
                ],
                version: '',
            };
            expect(exportToMarkdown(data)).toBe('[My Video](https://example.com/video.mp4)');
        });

        it('should convert mediaGallery blocks', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    {
                        id: '1',
                        type: 'mediaGallery',
                        data: {
                            items: [
                                { url: 'https://example.com/1.jpg', altText: 'Photo 1' },
                                { url: 'https://example.com/2.jpg', altText: 'Photo 2' },
                            ],
                        },
                    },
                ],
                version: '',
            };
            const md = exportToMarkdown(data);
            expect(md).toContain('![Photo 1](https://example.com/1.jpg)');
            expect(md).toContain('![Photo 2](https://example.com/2.jpg)');
        });

        it('should handle unknown block types', () => {
            const data: OutputData = {
                time: 0,
                blocks: [{ id: '1', type: 'unknownWidget', data: {} }],
                version: '',
            };
            expect(exportToMarkdown(data)).toBe('<!-- unknown block: unknownWidget -->');
        });

        it('should separate blocks with blank lines', () => {
            const data: OutputData = {
                time: 0,
                blocks: [
                    { id: '1', type: 'paragraph', data: { text: 'First' } },
                    { id: '2', type: 'paragraph', data: { text: 'Second' } },
                ],
                version: '',
            };
            expect(exportToMarkdown(data)).toBe('First\n\nSecond');
        });
    });
});
