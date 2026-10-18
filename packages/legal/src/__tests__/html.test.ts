import { describe, expect, it } from 'vitest';
import { assembleLegalDocument } from '../assemble';
import { documentToHtml, documentToMarkdown, inlineToHtml, markdownToHtml, pageToHtml, safeHref } from '../html';
import { extractToc } from '../toc';
import type { LegalConfig } from '../types';

const base: LegalConfig = {
    appName: 'Acme <Beta>',
    companyName: 'Acme & Sons Inc.',
    siteUrl: 'https://acme.test',
    contactEmail: 'support@acme.test',
    jurisdiction: 'Delaware',
    lastUpdated: '1 January 2026',
    copyrightYear: 2026,
    features: { paidPlans: true },
};

describe('inlineToHtml', () => {
    it('escapes text and renders links, bold, italic and code', () => {
        expect(inlineToHtml('a <b> & "c" **bold** *it* _it2_ `x<y`')).toBe(
            'a &lt;b&gt; &amp; &quot;c&quot; <strong>bold</strong> <em>it</em> <em>it2</em> <code>x&lt;y</code>',
        );
        expect(inlineToHtml('[Privacy](/legal/privacy) [mail](mailto:a@b.c) [out](https://x.test/p?q=1&r=2)')).toBe(
            '<a href="/legal/privacy">Privacy</a> <a href="mailto:a@b.c">mail</a> <a href="https://x.test/p?q=1&amp;r=2" target="_blank" rel="noopener noreferrer">out</a>',
        );
    });
    it('drops unsafe link addresses but keeps their text', () => {
        expect(safeHref('javascript:alert(1)')).toBeNull();
        expect(safeHref('//evil.test')).toBeNull();
        expect(safeHref('data:text/html,x')).toBeNull();
        expect(inlineToHtml('[click](javascript:alert%281%29) [x](//evil.test)')).toBe('click x');
    });
    it('cannot be broken out of by a config value that looks like markup', () => {
        const html = markdownToHtml('Contact **{{x}}**'.replace('{{x}}', '<img src=x onerror=alert(1)>'));
        expect(html).toBe('<p>Contact <strong>&lt;img src=x onerror=alert(1)&gt;</strong></p>');
    });
});

describe('markdownToHtml', () => {
    it('renders every block the templates use, with heading ids matching the TOC', () => {
        const md =
            '## Data we collect\n\nIntro line.\n\n- one\n- **two** [l](/x)\n\n1. a\n2. b\n\n> quoted\n\n---\n\n### Data we collect\n\nAcme Inc.  \n1 Main St';
        const html = markdownToHtml(md);
        expect(html).toContain('<h2 id="data-we-collect">Data we collect</h2>');
        expect(html).toContain('<h3 id="data-we-collect-1">Data we collect</h3>');
        expect(html).toContain('<ul><li>one</li><li><strong>two</strong> <a href="/x">l</a></li></ul>');
        expect(html).toContain('<ol><li>a</li><li>b</li></ol>');
        expect(html).toContain('<blockquote>quoted</blockquote>');
        expect(html).toContain('<hr>');
        expect(html).toContain('<p>Acme Inc.<br> 1 Main St</p>');
        expect(extractToc(md).map((t) => t.id)).toEqual(['data-we-collect', 'data-we-collect-1']);
    });
});

describe('documentToHtml, pageToHtml, documentToMarkdown', () => {
    const doc = assembleLegalDocument('refunds', base);
    it('renders the article with title, date, toc, body and copyright, all escaped', () => {
        const html = documentToHtml(doc);
        expect(html).toContain('<h1 class="otta-legal-title">Refund and Cancellation Policy</h1>');
        expect(html).toContain('Last updated 1 January 2026');
        expect(html).toContain('aria-label="On this page"');
        expect(html).toContain('<a href="#cancellations">Cancellations</a>');
        expect(html).toContain('Acme &lt;Beta&gt;');
        expect(html).toContain('© 2026 Acme &amp; Sons Inc. All rights reserved.');
        expect(html).not.toContain('<Beta>');
    });
    it('wraps a full page with nav, canonical and no template disclaimer', () => {
        const page = pageToHtml(base, doc);
        expect(page.startsWith('<!doctype html>')).toBe(true);
        expect(page).toContain('<title>Refund and Cancellation Policy · Acme &lt;Beta&gt;</title>');
        expect(page).toContain('<link rel="canonical" href="https://acme.test/legal/refunds">');
        expect(page).toContain('<a href="/legal/terms">Terms of Service</a>');
        expect(page).toContain('<a href="/legal/refunds" aria-current="page">Refund and Cancellation Policy</a>');
        expect(page).not.toContain('/legal/cookies');
        expect(page).not.toMatch(/not legal advice/i);
        const index = pageToHtml({ ...base, basePath: '/policies' });
        expect(index).toContain('<title>Legal · Acme &lt;Beta&gt;</title>');
        expect(index).toContain('href="/policies/privacy"');
        expect(index).toContain('<link rel="canonical" href="https://acme.test/policies">');
    });
    it('emits markdown with title and date', () => {
        const md = documentToMarkdown(doc);
        expect(md.startsWith('# Refund and Cancellation Policy\n\n_Last updated 1 January 2026_\n\n')).toBe(true);
        expect(md.endsWith('© 2026 Acme & Sons Inc. All rights reserved.')).toBe(true);
    });
});
