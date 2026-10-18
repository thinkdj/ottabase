import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { assembleLegalDocument } from '../assemble';
import { markdownToHtml } from '../html';
import * as root from '../index';
import * as react from '../react';
import { LegalDocument, LegalIndex, LegalMarkdown } from '../react';
import type { LegalConfig } from '../types';

const base: LegalConfig = {
    appName: 'Acme',
    companyName: 'Acme Inc.',
    siteUrl: 'https://acme.test',
    contactEmail: 'support@acme.test',
    jurisdiction: 'Delaware',
    lastUpdated: '1 January 2026',
    copyrightYear: 2026,
    features: { paidPlans: true, cookies: true },
};

describe('exports boundary', () => {
    it('the root entry is headless and the react entry has the components', () => {
        for (const name of ['LegalDocument', 'LegalIndex', 'LegalMarkdown']) {
            expect(root).not.toHaveProperty(name);
            expect(typeof (react as Record<string, unknown>)[name]).toBe('function');
        }
        for (const name of [
            'assembleLegalDocument',
            'createLegalPackage',
            'pageToHtml',
            'legalConfigFromApp',
            'validateLegalConfig',
        ])
            expect(typeof (root as Record<string, unknown>)[name]).toBe('function');
    });
});

describe('react renderers', () => {
    it('LegalMarkdown renders the same structure as the server renderer, with safe links only', () => {
        const md =
            '## Heading\n\nSee [privacy](/legal/privacy), [mail](mailto:a@b.c) and [bad](javascript:alert%281%29).\n\n- **one**\n- two\n\nAcme Inc.  \n1 Main St';
        const html = renderToStaticMarkup(<LegalMarkdown markdown={md} />);
        expect(html).toContain('<h2 id="heading" class="otta-legal-h2">Heading</h2>');
        expect(html).toContain('<a class="otta-legal-a" href="/legal/privacy">privacy</a>');
        expect(html).toContain('<a class="otta-legal-a" href="mailto:a@b.c">mail</a>');
        expect(html).not.toContain('javascript:');
        expect(html).toContain('bad.');
        expect(html).toContain('<li><strong>one</strong></li><li>two</li>');
        expect(html).toContain('Acme Inc.<br/>1 Main St');
        // The two renderers agree on the headings and their anchors.
        expect(markdownToHtml(md).match(/id="[^"]+"/g)).toEqual(html.match(/id="[^"]+"/g));
    });
    it('LegalDocument renders title, date, toc, body and copyright; LegalIndex lists the enabled documents', () => {
        const doc = renderToStaticMarkup(<LegalDocument docId="cookies" config={base} />);
        expect(doc).toContain('<h1 class="otta-legal-title">Cookie Policy</h1>');
        expect(doc).toContain('Last updated 1 January 2026');
        expect(doc).toContain('aria-label="On this page"');
        expect(doc).toContain('href="#essential-cookies"');
        expect(doc).toContain('© 2026 Acme Inc. All rights reserved.');
        const custom = renderToStaticMarkup(
            <LegalDocument docId="terms" config={base} toc={false} renderMarkdown={(m) => <pre>{m.length}</pre>} />,
        );
        expect(custom).toContain(`<pre>${assembleLegalDocument('terms', base).markdown.length}</pre>`);
        expect(custom).not.toContain('On this page');
        const index = renderToStaticMarkup(
            <LegalIndex config={{ ...base, basePath: '/policies' }} heading={<h1>Legal</h1>} />,
        );
        expect(index).toContain('<h1>Legal</h1>');
        expect(index).toContain('href="/policies/cookies"');
        expect(index).toContain('href="/policies/refunds"');
        expect(index).not.toContain('subprocessors');
    });
});
