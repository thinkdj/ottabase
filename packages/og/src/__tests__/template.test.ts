import { describe, expect, it } from 'vitest';
import { createOgTemplate, renderOgHtml, titleSize } from '../template';

describe('the default template', () => {
    it('escapes every field and keeps scripts out of the page', () => {
        const html = renderOgHtml({
            title: '<script>alert(1)</script>',
            subtitle: 'a "quoted" & more',
            eyebrow: "it's",
            siteName: '<b>',
            author: '<i>',
        });
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).toContain('a &quot;quoted&quot; &amp; more');
        expect(html).toContain('it&#39;s');
        expect(html).toContain('<b>&lt;b&gt;</b>');
        expect(html).toContain('&lt;i&gt;');
    });

    it('draws only http(s) images, and switches to the shaded look over a background', () => {
        const plain = renderOgHtml({ title: 'a', logoUrl: 'javascript:alert(1)' });
        expect(plain).not.toContain('<img');
        expect(plain).toContain('class="band"');
        const pictured = renderOgHtml({
            title: 'a',
            imageUrl: 'https://x.test/a.jpg?w=1&h=2',
            logoUrl: 'https://x.test/l.png',
        });
        expect(pictured).toContain('url("https://x.test/a.jpg?w=1&h=2")');
        expect(pictured).toContain('class="shade"');
        expect(pictured).toContain('<img src="https://x.test/l.png" alt="">');
        expect(pictured).not.toContain('class="band"');
    });

    it('takes the brand colors, the theme, and a web font', () => {
        const html = createOgTemplate({ fontCss: '@import url("https://fonts.test/inter.css");', fontFamily: 'Inter' })(
            {
                title: 'a',
                accent: '#ff0000',
                background: '#123456',
                theme: 'light',
            },
        );
        expect(html).toContain('@import url("https://fonts.test/inter.css");');
        expect(html).toContain('font-family: Inter, -apple-system');
        expect(html).toContain('background: #ff0000');
        expect(html).toContain('background: #123456');
        expect(html).toContain('color: #0f172a');
    });

    it('sizes the title to its length', () => {
        expect(titleSize('Short')).toBe(80);
        expect(titleSize('x'.repeat(60))).toBe(64);
        expect(titleSize('x'.repeat(100))).toBe(52);
        expect(titleSize('x'.repeat(150))).toBe(42);
    });
});
