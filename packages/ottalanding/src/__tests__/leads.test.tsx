import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { leadDigest, leadsToCsv, type LeadData } from '../leads';
import { LeadForm } from '../react/lead-form';

const lead = (over: Partial<LeadData> = {}): LeadData => ({
    id: '1',
    kind: 'contact',
    email: 'ada@example.com',
    name: 'Ada',
    message: 'Hi',
    pagePath: '/contact',
    read: false,
    createdAt: '2026-10-11T09:00:00.000Z',
    ...over,
});

describe('leadsToCsv', () => {
    it('writes a header and one quoted row per entry', () => {
        expect(leadsToCsv([lead({ message: 'Say "hi",\nplease' })])).toBe(
            '"Date","Type","Name","Email","Message","Page"\r\n' +
                '"2026-10-11T09:00:00.000Z","contact","Ada","ada@example.com","Say ""hi"",\nplease","/contact"\r\n',
        );
    });

    it('defuses cells a spreadsheet would run as formulas', () => {
        const csv = leadsToCsv([lead({ name: '=HYPERLINK("http://evil")', message: '+1 555', email: '@x' })]);
        expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
        expect(csv).toContain(`"'+1 555"`);
        expect(csv).toContain(`"'@x"`);
    });
});

describe('LeadForm', () => {
    const classes = { input: 'in', button: 'btn', label: 'lbl', note: 'note', error: 'err' };
    const render = (kind: 'contact' | 'signup', extra = {}) =>
        renderToStaticMarkup(<LeadForm kind={kind} classes={classes} {...extra} />);

    it('asks a contact for name, email and message, each labelled and required', () => {
        const html = render('contact');
        for (const name of ['name', 'email', 'message']) {
            const tag = html.match(new RegExp(`<(?:input|textarea)[^>]*\\bname="${name}"[^>]*>`))?.[0];
            expect(tag, name).toContain('required=""');
        }
        expect(html).toContain('>Name</label>');
        expect(html).toContain('>Send message</button>');
    });

    it('asks a signup for an email only, labelled for screen readers', () => {
        const html = render('signup', { buttonLabel: 'Subscribe' });
        expect(html).not.toContain('name="name"');
        expect(html).toContain('class="sr-only"');
        expect(html).toContain('>Subscribe</button>');
    });

    it('hides the bot trap from people and assistive tech', () => {
        const html = render('signup');
        const trap = html.match(/<div aria-hidden="true"[^>]*><label>Website<input [^>]*>/)?.[0];
        expect(trap).toContain('name="website"');
        expect(trap).toContain('tabindex="-1"');
    });
});

describe('leadDigest', () => {
    it('names a single entry in the subject, and counts several', () => {
        expect(leadDigest('Acme', [lead()]).subject).toBe('Acme: new message from Ada');
        expect(leadDigest('Acme', [lead({ kind: 'signup', name: '' })]).subject).toBe(
            'Acme: new signup: ada@example.com',
        );
        expect(leadDigest('Acme', [lead(), lead()]).subject).toBe('Acme: 2 new form entries');
    });

    it('escapes everything a visitor typed, keeps the subject on one line, and links the inbox', () => {
        const nasty = lead({ name: 'Eve\r\nBcc: x@y.z {{secret}}', message: '<script>alert(1)</script>{{#each}}' });
        const { subject, body } = leadDigest('Acme', [nasty], 'https://admin.acme.dev/admin/content/landing/leads');
        expect(subject).not.toMatch(/[\r\n{}]/);
        expect(body).not.toContain('<script>');
        expect(body).toContain('&#60;script&#62;');
        expect(body).not.toMatch(/\{\{|\}\}/);
        expect(body).toContain('href="https://admin.acme.dev/admin/content/landing/leads"');
        expect(leadDigest('<Acme>', [nasty]).header).toContain('&#60;Acme&#62;: a new form entry');
    });
});
