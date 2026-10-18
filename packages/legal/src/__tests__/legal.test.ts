import { describe, expect, it } from 'vitest';
import { assembleLegalDocument, listLegalDocuments, resolveLegalSlug } from '../assemble';
import { emailAddressOf, legalConfigFromApp, validateLegalConfig } from '../config';
import { buildVars, interpolate, makeHeadingSlugger, slugify } from '../interpolate';
import { docEnabled, LEGAL_DOC_ORDER } from '../registry';
import { extractToc } from '../toc';
import type { LegalConfig } from '../types';

const base: LegalConfig = {
    appName: 'Acme',
    companyName: 'Acme Inc.',
    siteUrl: 'https://acme.test/',
    contactEmail: 'support@acme.test',
    jurisdiction: 'Delaware, United States',
    lastUpdated: '1 January 2026',
    copyrightYear: 2026,
};

describe('interpolate', () => {
    it('replaces placeholders, tolerates whitespace, blanks unknown ones', () => {
        expect(
            interpolate('Hi {{appName}} / {{ companyName }} {{nope}}', { appName: 'Acme', companyName: 'Acme Inc.' }),
        ).toBe('Hi Acme / Acme Inc. ');
    });
});

describe('buildVars', () => {
    it('derives defaults', () => {
        const v = buildVars(base, 'terms');
        expect(v.privacyEmail).toBe('support@acme.test');
        expect(v.governingLaw).toBe('Delaware, United States');
        expect(v.legalBase).toBe('/legal');
        expect(v.siteUrl).toBe('https://acme.test');
        expect(v.refundWindowDays).toBe('14');
        expect(v.noticeDays).toBe('30');
        expect(v.deletionDays).toBe('30');
        expect(v.minimumAge).toBe('');
        expect(v.lastUpdated).toBe('1 January 2026');
    });
    it('honours overrides, per-doc dates, extraVars and basePath', () => {
        const v = buildVars(
            {
                ...base,
                basePath: '/policies/',
                privacyEmail: 'privacy@acme.test',
                lastUpdated: { privacy: '1 June 2026' },
                refundWindowDays: 0,
                minimumAge: 16,
                extraVars: { x: 1 },
            },
            'privacy',
        );
        expect(v.legalBase).toBe('/policies');
        expect(v.privacyEmail).toBe('privacy@acme.test');
        expect(v.lastUpdated).toBe('1 June 2026');
        expect(v.refundWindowDays).toBe('0');
        expect(v.minimumAge).toBe('16');
        expect(v.x).toBe('1');
    });
    it('builds a markdown sub-processor list', () => {
        const v = buildVars({
            ...base,
            subProcessors: [{ name: 'Cloudflare', purpose: 'Hosting', location: 'Global', url: 'https://cf.test' }],
        });
        expect(v.subProcessorList).toBe('- **Cloudflare**: Hosting (Global). [Privacy information](https://cf.test)');
    });
});

describe('slugify, slugger, toc', () => {
    it('slugifies and dedups in order', () => {
        expect(slugify('Your Rights & Choices!')).toBe('your-rights-choices');
        const s = makeHeadingSlugger();
        expect(s('Contact')).toBe('contact');
        expect(s('Contact')).toBe('contact-1');
    });
    it('extracts a TOC whose ids match the slugger', () => {
        expect(extractToc('## Data we collect\n\nbody\n\n### Sub heading\n\n## Data we collect')).toEqual([
            { id: 'data-we-collect', text: 'Data we collect', level: 2 },
            { id: 'sub-heading', text: 'Sub heading', level: 3 },
            { id: 'data-we-collect-1', text: 'Data we collect', level: 2 },
        ]);
    });
});

describe('assembleLegalDocument', () => {
    it('interpolates and builds title, toc, copyright and cross-links', () => {
        const doc = assembleLegalDocument('terms', base);
        expect(doc.title).toBe('Terms of Service');
        expect(doc.slug).toBe('terms');
        expect(doc.lastUpdated).toBe('1 January 2026');
        expect(doc.markdown).toContain('Acme Inc.');
        expect(doc.markdown).toContain('## Eligibility and your account');
        expect(doc.markdown).toContain('[Acceptable Use Policy](/legal/acceptable-use)');
        expect(doc.copyright).toBe('© 2026 Acme Inc. All rights reserved.');
        expect(doc.toc.length).toBeGreaterThan(5);
        expect(assembleLegalDocument('terms', { ...base, basePath: '/policies' }).markdown).toContain(
            '(/policies/acceptable-use)',
        );
    });
    it('throws on an unknown document and ignores prototype keys', () => {
        expect(() => assembleLegalDocument('nope' as never, base)).toThrow(/Unknown legal document/);
        expect(docEnabled('toString' as never, base)).toBe(false);
        expect(resolveLegalSlug('constructor', base)).toBeNull();
    });
    it('leaves no blank run where an optional address is unset, and merges a conditional bullet into its list', () => {
        const privacy = assembleLegalDocument('privacy', { ...base, features: { paidPlans: true } }).markdown;
        expect(privacy).not.toMatch(/\n{3,}/);
        expect(privacy).toMatch(
            /approximate location derived from the IP address, and crash or error reports\.\n- \*\*Payment data\*\*/,
        );
    });
});

describe('conditional clauses', () => {
    it('terms clauses follow the flags and the minimum age', () => {
        const plain = assembleLegalDocument('terms', base).markdown;
        expect(plain).toContain('You must be old enough to form a binding contract');
        for (const absent of [
            'Subscriptions and billing',
            'Free trials',
            'Lifetime purchases',
            'Your content',
            'Organizations',
            'API and integrations',
            'AI features',
            'Data protection',
        ])
            expect(plain).not.toContain(absent);
        const full = assembleLegalDocument('terms', {
            ...base,
            minimumAge: 16,
            features: {
                paidPlans: true,
                freeTrial: true,
                lifetimePlans: true,
                userContent: true,
                organizations: true,
                api: true,
                ai: true,
                eu: true,
            },
        }).markdown;
        expect(full).toContain('You must be at least 16 years old');
        expect(full).not.toContain(
            'old enough to form a binding contract where you live to use the Service.\n\nYou agree',
        );
        for (const present of [
            '## Subscriptions and billing',
            '## Free trials',
            '## Lifetime purchases',
            '## Your content',
            '## Organizations and shared workspaces',
            '## API and integrations',
            '## AI features',
            '## Data protection',
            'at least 30 days notice',
        ])
            expect(full).toContain(present);
    });
    it('privacy clauses gate on eu, california, ai, cookies, analytics, email, payment and children', () => {
        const plain = assembleLegalDocument('privacy', base).markdown;
        for (const absent of [
            'Legal bases',
            'California privacy rights',
            '## AI features',
            'Cookies and similar',
            '## Analytics',
            '## Communications',
            'Payment data',
            'International transfers',
            'lodge a complaint',
        ])
            expect(plain).not.toContain(absent);
        expect(plain).toContain("## Children's privacy");
        expect(plain).not.toContain('Sub-processors](');
        const full = assembleLegalDocument('privacy', {
            ...base,
            features: {
                eu: true,
                california: true,
                ai: true,
                cookies: true,
                analytics: true,
                email: true,
                paidPlans: true,
                children: true,
            },
            subProcessors: [{ name: 'X', purpose: 'y' }],
        }).markdown;
        for (const present of [
            '## Legal bases for processing',
            '## California privacy rights',
            '## AI features',
            '## Cookies and similar technologies',
            '## Analytics',
            '## Communications',
            'Payment data',
            '## International transfers',
            'lodge a complaint',
            '[Sub-processors](/legal/subprocessors)',
            'within 30 days',
        ])
            expect(full).toContain(present);
        expect(full).not.toContain("Children's privacy");
    });
    it('refunds switch to a no-refund policy at 0 days and keep statutory rights', () => {
        const paid = { ...base, features: { paidPlans: true, freeTrial: true, lifetimePlans: true } };
        const window = assembleLegalDocument('refunds', paid).markdown;
        expect(window).toContain('within 14 days of a charge and we will refund it');
        expect(window).toContain('## Free trials');
        expect(window).toContain('## Lifetime purchases');
        const none = assembleLegalDocument('refunds', { ...paid, refundWindowDays: 0 }).markdown;
        expect(none).toContain('Charges are non-refundable');
        expect(none).not.toContain('within 0 days');
        expect(none).toContain('## Your statutory rights');
    });
    it('cookies and acceptable use follow analytics and api', () => {
        expect(assembleLegalDocument('cookies', { ...base, features: { cookies: true } }).markdown).not.toContain(
            '## Analytics cookies',
        );
        expect(
            assembleLegalDocument('cookies', { ...base, features: { cookies: true, analytics: true } }).markdown,
        ).toContain('## Analytics cookies');
        expect(assembleLegalDocument('acceptable-use', base).markdown).not.toContain('## API and automation');
        expect(assembleLegalDocument('acceptable-use', { ...base, features: { api: true } }).markdown).toContain(
            '## API and automation',
        );
    });
    it('sub-processors renders the list, or says it is coming', () => {
        expect(assembleLegalDocument('subprocessors', { ...base, features: { eu: true } }).markdown).toContain(
            'We will publish the list',
        );
        const listed = assembleLegalDocument('subprocessors', {
            ...base,
            subProcessors: [{ name: 'Cloudflare, Inc.', purpose: 'Hosting' }],
        }).markdown;
        expect(listed).toContain('- **Cloudflare, Inc.**: Hosting');
        expect(listed).not.toContain('We will publish the list');
    });
});

describe('overrides', () => {
    it('removes, replaces, prepends and appends sections', () => {
        const doc = assembleLegalDocument('terms', {
            ...base,
            overrides: {
                terms: {
                    remove: ['indemnification'],
                    replace: { intro: { body: 'Custom intro for {{appName}}.' } },
                    prepend: [{ id: 'notice', body: 'Read this first.' }],
                    append: [{ id: 'extra', title: 'Extra clause', body: 'Something specific.' }],
                },
            },
        });
        expect(doc.markdown.startsWith('Read this first.')).toBe(true);
        expect(doc.markdown).toContain('Custom intro for Acme.');
        expect(doc.markdown).toContain('## Extra clause');
        expect(doc.markdown).not.toContain('Indemnification');
    });
});

describe('document enablement', () => {
    it('lists only enabled documents, in order', () => {
        expect(listLegalDocuments(base).map((d) => d.id)).toEqual(['terms', 'privacy', 'acceptable-use']);
        expect(
            listLegalDocuments({ ...base, features: { cookies: true, paidPlans: true, eu: true } }).map((d) => d.id),
        ).toEqual(LEGAL_DOC_ORDER);
        expect(resolveLegalSlug('refunds', base)).toBeNull();
        expect(resolveLegalSlug('refunds', { ...base, features: { paidPlans: true } })).toBe('refunds');
        expect(resolveLegalSlug('nope', base)).toBeNull();
    });
});

describe('legalConfigFromApp and validateLegalConfig', () => {
    const app = { appName: 'Acme', meta: { companyName: 'Acme Labs Ltd.' }, email: { from: 'Acme <hello@acme.test>' } };
    it('seeds names and contact from the app config, and parses a named sender', () => {
        expect(emailAddressOf('Acme <hello@acme.test>')).toBe('hello@acme.test');
        expect(emailAddressOf('hello@acme.test')).toBe('hello@acme.test');
        const cfg = legalConfigFromApp(app, {
            siteUrl: 'https://acme.test',
            jurisdiction: 'England and Wales',
            lastUpdated: '1 January 2026',
        });
        expect(cfg).toMatchObject({ appName: 'Acme', companyName: 'Acme Labs Ltd.', contactEmail: 'hello@acme.test' });
        expect(
            legalConfigFromApp(
                { appName: 'Solo' },
                { contactEmail: 'me@solo.test', siteUrl: 'https://solo.test', jurisdiction: 'x', lastUpdated: 'y' },
            ).companyName,
        ).toBe('Solo');
        expect(() =>
            legalConfigFromApp(
                { appName: 'Solo' },
                { siteUrl: 'https://solo.test', jurisdiction: 'x', lastUpdated: 'y' },
            ),
        ).toThrow(/contactEmail/);
    });
    it('passes a complete config and names every gap in an incomplete one', () => {
        expect(validateLegalConfig(base)).toEqual([]);
        const gaps = validateLegalConfig({
            ...base,
            siteUrl: 'http://acme.test',
            contactEmail: 'nope',
            jurisdiction: 'TODO',
            lastUpdated: { terms: '1 January 2026' },
            refundWindowDays: -1,
            features: { eu: true, ai: true, paidPlans: true },
            subProcessors: [],
        });
        expect(gaps).toEqual(
            expect.arrayContaining([
                expect.stringContaining('siteUrl must be an https URL'),
                expect.stringContaining('contactEmail'),
                expect.stringContaining('jurisdiction is missing or still a placeholder'),
                expect.stringContaining('lastUpdated has no date for the Privacy Policy'),
                expect.stringContaining('companyAddress is required for EU/UK users'),
                expect.stringContaining('subProcessors is empty while features.eu is on'),
                expect.stringContaining('refundWindowDays must be a whole number'),
            ]),
        );
        expect(gaps.some((g) => g.includes('for the Terms of Service'))).toBe(false);
    });
});
