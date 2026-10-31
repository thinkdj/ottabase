import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { autoInit, clearConnection, DomainValidationError, registerConnection } from '@ottabase/ottaorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PAGES, DEFAULT_SITE } from '../defaults';
import { LandingPage } from '../ottaorm-models/LandingPage';
import { LandingSite } from '../ottaorm-models/LandingSite';
import { LandingLead } from '../ottaorm-models/LandingLead';
import { landingLeadsTable, landingPagesTable, landingSitesTable } from '../schema';
import { createSqliteD1 } from './sqlite-d1';

async function rejection(promise: Promise<unknown>): Promise<DomainValidationError> {
    try {
        await promise;
    } catch (error) {
        expect(error).toBeInstanceOf(DomainValidationError);
        return error as DomainValidationError;
    }
    throw new Error('expected a DomainValidationError');
}

beforeAll(async () => {
    const driver = createD1Driver(createSqliteD1());
    const schema = { landingSitesTable, landingPagesTable, landingLeadsTable };
    const result = await autoInit({ driver, schema, verbose: false });
    expect(result.details.errors).toEqual([]);
    expect(result.details.tablesCreated.sort()).toEqual(['landing_leads', 'landing_pages', 'landing_sites']);
    registerConnection('default', driver);
});

afterAll(() => clearConnection('default'));

describe('LandingSite', () => {
    it('returns null for an app that has not been set up (public reads never write)', async () => {
        expect(await LandingSite.findForApp('fresh-app')).toBeNull();
        expect(await LandingPage.count({ appId: 'fresh-app' })).toBe(0);
    });

    it('seeds starter settings and pages once, idempotently', async () => {
        const site = await LandingSite.ensureForApp('app-a');
        expect(site.getSettings()).toEqual(DEFAULT_SITE);
        await LandingSite.ensureForApp('app-a');
        expect(await LandingSite.count({ appId: 'app-a' })).toBe(1);
        expect(await LandingPage.count({ appId: 'app-a' })).toBe(DEFAULT_PAGES.length);
    });

    it('seeds safely when two first requests race', async () => {
        await Promise.all([LandingSite.ensureForApp('app-race'), LandingSite.ensureForApp('app-race')]);
        expect(await LandingSite.count({ appId: 'app-race' })).toBe(1);
        expect(await LandingPage.count({ appId: 'app-race' })).toBe(DEFAULT_PAGES.length);
    });

    it('finishes an interrupted seed instead of leaving the site half-built', async () => {
        // A previous first run created one starter page, then failed before the site row existed.
        await LandingPage.createFor('app-partial', DEFAULT_PAGES[1]);
        await LandingSite.ensureForApp('app-partial');
        expect(await LandingPage.count({ appId: 'app-partial' })).toBe(DEFAULT_PAGES.length);
        expect(await LandingPage.findPublished('app-partial', '/')).not.toBeNull();
    });

    it('validates settings and reports per-field errors', async () => {
        const error = await rejection(LandingSite.saveSettings('app-a', { ...DEFAULT_SITE, theme: 'nope', name: '' }));
        expect(Object.keys(error.fieldErrors).sort()).toEqual(['name', 'theme']);

        const saved = await LandingSite.saveSettings('app-a', { ...DEFAULT_SITE, theme: 'bold', name: 'Acme' });
        expect(saved.getSettings()).toMatchObject({ theme: 'bold', name: 'Acme' });
    });

    it('keeps every valid stored setting when one no longer fits, instead of reverting the whole site', async () => {
        const site = await LandingSite.ensureForApp('app-lenient');
        // Stored before a rule was tightened (or edited by hand): written raw, bypassing validation.
        await LandingSite.update(site.get('id') as string, {
            settings: {
                ...DEFAULT_SITE,
                name: 'Acme Rockets',
                theme: 'retired-theme',
                siteUrl: '/relative',
                nav: [
                    { label: 'Pricing', href: '/pricing' },
                    { label: 'Bad', href: 'javascript:alert(1)' },
                ],
            },
        });
        const settings = (await LandingSite.findForApp('app-lenient'))!.getSettings();
        expect(settings.name).toBe('Acme Rockets'); // kept, not the starter "Ottabase"
        expect(settings.theme).toBe(DEFAULT_SITE.theme); // only the invalid field falls back
        expect(settings.siteUrl).toBeUndefined(); // invalid optional field is dropped
        expect(settings.nav).toEqual([{ label: 'Pricing', href: '/pricing' }]); // only the bad item goes
    });

    it('rejects unsafe link schemes', async () => {
        const nav = [{ label: 'x', href: 'javascript:alert(1)' }];
        const error = await rejection(LandingSite.saveSettings('app-a', { ...DEFAULT_SITE, nav }));
        expect(error.fieldErrors['nav.0.href']).toBeDefined();
    });
});

describe('LandingPage', () => {
    it('round-trips sections through the JSON column', async () => {
        const home = await LandingPage.findPublished('app-a', '/');
        expect(home?.toPage().sections).toEqual(DEFAULT_PAGES[0].sections);
    });

    it('keeps apps isolated', async () => {
        await LandingSite.ensureForApp('app-b');
        const a = await LandingPage.findPublished('app-a', '/about');
        expect(await LandingPage.findForApp('app-b', a!.get('id') as string)).toBeNull();
        expect(await LandingPage.updateFor('app-b', a!.get('id') as string, { path: '/x', title: 'x' })).toBeNull();
    });

    it('creates, enforces unique paths, and hides unpublished pages from public reads', async () => {
        const page = await LandingPage.createFor('app-a', { path: '/pricing', title: 'Pricing' });
        expect(page.toPage()).toMatchObject({ path: '/pricing', published: false, sections: [] });
        expect(await LandingPage.findPublished('app-a', '/pricing')).toBeNull();

        const taken = await rejection(LandingPage.createFor('app-a', { path: '/pricing', title: 'Again' }));
        expect(taken.code).toBe('PATH_TAKEN');
        const bad = await rejection(LandingPage.createFor('app-a', { path: 'Pricing Page', title: 'x' }));
        expect(bad.fieldErrors.path).toBeDefined();
    });

    it('validates section data on update with field paths the admin can highlight', async () => {
        const page = await LandingPage.findPublished('app-a', '/about');
        const id = page!.get('id') as string;
        const input = { ...page!.toPage(), sections: [{ id: 's1', type: 'hero', data: { title: '' } }] };
        const error = await rejection(LandingPage.updateFor('app-a', id, input));
        expect(error.fieldErrors['sections.0.data.title']).toEqual(['Required']);

        input.sections[0].data.title = 'Hello';
        const updated = await LandingPage.updateFor('app-a', id, input);
        expect(updated?.toPage().sections).toEqual([{ id: 's1', type: 'hero', data: { title: 'Hello' } }]);
    });

    it('drops stored sections that no longer match the catalog instead of crashing', async () => {
        const page = await LandingPage.findPublished('app-a', '/contact');
        await LandingPage.update(page!.get('id') as string, {
            sections: [{ id: 'x', type: 'retired-widget', data: {} }, ...page!.toPage().sections],
        });
        const reread = await LandingPage.findPublished('app-a', '/contact');
        expect(reread?.toPage().sections.map((s) => s.type)).toEqual(['hero', 'contact']);
    });

    it('keeps the home page at / on the server, not just in the UI', async () => {
        const home = await LandingPage.findPublished('app-a', '/');
        const moved = await rejection(
            LandingPage.updateFor('app-a', home!.get('id') as string, { ...home!.toPage(), path: '/old-home' }),
        );
        expect(moved.code).toBe('HOME_PAGE_REQUIRED');
        expect(moved.fieldErrors.path).toBeDefined();
        expect(await LandingPage.findPublished('app-a', '/')).not.toBeNull();
    });

    it('reports a path collision from concurrent creates as PATH_TAKEN, not a raw database error', async () => {
        const results = await Promise.allSettled([
            LandingPage.createFor('app-a', { path: '/race', title: 'One' }),
            LandingPage.createFor('app-a', { path: '/race', title: 'Two' }),
        ]);
        const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        expect(failures).toHaveLength(1);
        expect(failures[0].reason).toBeInstanceOf(DomainValidationError);
        expect((failures[0].reason as DomainValidationError).code).toBe('PATH_TAKEN');
    });

    it('refuses to delete the home page but deletes others', async () => {
        const home = await LandingPage.findPublished('app-a', '/');
        const error = await rejection(LandingPage.deleteFor('app-a', home!.get('id') as string));
        expect(error.code).toBe('HOME_PAGE_REQUIRED');

        const contact = await LandingPage.findPublished('app-a', '/contact');
        expect(await LandingPage.deleteFor('app-a', contact!.get('id') as string)).toBe(true);
        expect(await LandingPage.findPublished('app-a', '/contact')).toBeNull();
    });
});

describe('LandingPage social image and sitemap', () => {
    it('stores a page’s own social image, and clears it when the page goes back to the site’s', async () => {
        const share = { heading: 'Pricing that scales', imageUrl: '/api/files/public/landing/a/share/p.png?v=1' };
        const page = await LandingPage.createFor('app-share', { path: '/pricing', title: 'Pricing', share });
        const id = page.get('id') as string;
        expect((await LandingPage.findForApp('app-share', id))!.toPage().share).toEqual(share);

        await LandingPage.updateFor('app-share', id, { path: '/pricing', title: 'Pricing' });
        expect((await LandingPage.findForApp('app-share', id))!.toPage()).not.toHaveProperty('share');
    });

    it('lists only published pages for the sitemap, with when they last changed', async () => {
        await LandingPage.createFor('app-map', { path: '/', title: 'Home', published: true });
        await LandingPage.createFor('app-map', { path: '/draft', title: 'Draft' });
        const paths = await LandingPage.publishedPaths('app-map');
        expect(paths.map((p) => p.path)).toEqual(['/']);
        expect(paths[0].updatedAt).toBeInstanceOf(Date);
    });
});

describe('LandingPage preview links', () => {
    it('opens a draft only with its current token, and a reset retires the old link', async () => {
        const draft = await LandingPage.createFor('app-preview', { path: '/launch', title: 'Launch' });
        const id = draft.get('id') as string;
        expect(await LandingPage.findPublished('app-preview', '/launch')).toBeNull();

        const token = (await LandingPage.previewTokenFor('app-preview', id))!;
        expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/);
        expect(await LandingPage.previewTokenFor('app-preview', id)).toBe(token); // stable until reset
        expect((await LandingPage.findForPreview('app-preview', '/launch', token))?.get('id')).toBe(id);

        const fresh = (await LandingPage.previewTokenFor('app-preview', id, true))!;
        expect(fresh).not.toBe(token);
        expect(await LandingPage.findForPreview('app-preview', '/launch', token)).toBeNull();
        expect(await LandingPage.findForPreview('app-preview', '/launch', fresh)).not.toBeNull();
    });

    it('never matches a missing, malformed or other-page token', async () => {
        const a = await LandingPage.createFor('app-preview', { path: '/a', title: 'A' });
        await LandingPage.createFor('app-preview', { path: '/b', title: 'B' });
        const token = (await LandingPage.previewTokenFor('app-preview', a.get('id') as string))!;
        expect(await LandingPage.findForPreview('app-preview', '/b', token)).toBeNull();
        expect(await LandingPage.findForPreview('app-other', '/a', token)).toBeNull();
        expect(await LandingPage.findForPreview('app-preview', '/a', '')).toBeNull();
        expect(await LandingPage.findForPreview('app-preview', '/a', "' OR 1=1 --")).toBeNull();
        expect(await LandingPage.previewTokenFor('app-preview', 'nope')).toBeNull();
    });

    it('keeps the token out of the page data the renderer and API see', async () => {
        const page = await LandingPage.createFor('app-preview', { path: '/c', title: 'C' });
        await LandingPage.previewTokenFor('app-preview', page.get('id') as string);
        const reloaded = await LandingPage.findForApp('app-preview', page.get('id') as string);
        expect(JSON.stringify(reloaded!.toPage())).not.toMatch(/preview/i);
    });
});

describe('LandingLead', () => {
    const contact = {
        kind: 'contact',
        name: 'Ada',
        email: 'Ada@Example.com ',
        message: 'Hello!',
        pagePath: '/contact',
        elapsedMs: 8000,
    };

    it('stores a valid entry, normalising the email', async () => {
        expect(await LandingLead.submit('app-leads', contact, { ipHash: 'net-1' })).toBe('stored');
        const { leads, total, unread } = await LandingLead.inbox('app-leads');
        expect(total).toBe(1);
        expect(unread).toBe(1);
        expect(leads[0]).toMatchObject({
            kind: 'contact',
            name: 'Ada',
            email: 'ada@example.com',
            message: 'Hello!',
            read: false,
        });
    });

    it('rejects an incomplete contact entry field by field', async () => {
        const error = await rejection(
            LandingLead.submit('app-leads', { ...contact, name: '', message: ' ', email: 'nope' }),
        );
        expect(Object.keys(error.fieldErrors).sort()).toEqual(['email', 'message', 'name']);
    });

    it('quietly drops likely bots: a filled hidden field, or a form sent too fast', async () => {
        expect(await LandingLead.submit('app-bots', { ...contact, website: 'http://spam.example' })).toBe('ignored');
        expect(await LandingLead.submit('app-bots', { ...contact, elapsedMs: 300 })).toBe('ignored');
        expect(await LandingLead.submit('app-bots', { ...contact, elapsedMs: undefined })).toBe('ignored');
        expect(await LandingLead.count({ appId: 'app-bots' })).toBe(0);
    });

    it('limits how often one network can post, without affecting others', async () => {
        for (let i = 0; i < 5; i++)
            expect(await LandingLead.submit('app-flood', contact, { ipHash: 'net-x' })).toBe('stored');
        expect(await LandingLead.submit('app-flood', contact, { ipHash: 'net-x' })).toBe('rate-limited');
        expect(await LandingLead.submit('app-flood', contact, { ipHash: 'net-y' })).toBe('stored');
    });

    it('keeps one signup per email', async () => {
        const signup = { kind: 'signup', email: 'fan@example.com', elapsedMs: 4000 };
        expect(await LandingLead.submit('app-list', signup)).toBe('stored');
        expect(await LandingLead.submit('app-list', { ...signup, email: 'FAN@example.com' })).toBe('ignored');
        expect(await LandingLead.count({ appId: 'app-list', kind: 'signup' })).toBe(1);
    });

    it('reads, filters, marks read and deletes within one app only', async () => {
        await LandingLead.submit('app-inbox', contact);
        await LandingLead.submit('app-inbox', { kind: 'signup', email: 'x@example.com', elapsedMs: 4000 });
        const all = await LandingLead.inbox('app-inbox');
        expect(all.leads.map((l) => l.kind).sort()).toEqual(['contact', 'signup']);
        expect((await LandingLead.inbox('app-inbox', { kind: 'signup' })).total).toBe(1);

        const id = all.leads.find((l) => l.kind === 'contact')!.id;
        expect(await LandingLead.setRead('app-other', id, true)).toBe(false);
        expect(await LandingLead.setRead('app-inbox', id, true)).toBe(true);
        expect((await LandingLead.inbox('app-inbox')).unread).toBe(1);
        expect(await LandingLead.deleteFor('app-other', id)).toBe(false);
        expect(await LandingLead.deleteFor('app-inbox', id)).toBe(true);
        expect((await LandingLead.inbox('app-inbox')).total).toBe(1);
    });

    it('hands out each entry for notification once', async () => {
        await LandingLead.submit('app-notify', contact);
        await LandingLead.submit('app-notify', { ...contact, name: 'Grace' });
        const pending = await LandingLead.pendingNotification('app-notify');
        expect(pending.map((l) => l.toLead().name).sort()).toEqual(['Ada', 'Grace']);
        await LandingLead.markNotified(
            'app-notify',
            pending.map((l) => l.get('id') as string),
        );
        expect(await LandingLead.pendingNotification('app-notify')).toEqual([]);
    });

    it('announces each entry once across runs, apart from the digest', async () => {
        await LandingLead.submit('app-announce', contact);
        await LandingLead.submit('app-announce', { kind: 'signup', email: 'fan@example.com', elapsedMs: 4000 });
        const emitted: unknown[] = [];
        const emit = async (event: unknown) => void emitted.push(event);

        expect(await LandingLead.announceNew('app-announce', emit)).toBe(2);
        // Both were stored in the same millisecond, maybe: where() breaks the createdAt tie by the
        // random UUID id, so their order is not part of the contract.
        expect(emitted).toHaveLength(2);
        expect(emitted).toEqual(
            expect.arrayContaining([
                {
                    leadId: expect.any(String),
                    kind: 'contact',
                    email: 'ada@example.com',
                    name: 'Ada',
                    message: 'Hello!',
                    pagePath: '/contact',
                    at: expect.any(Number),
                },
                expect.objectContaining({ kind: 'signup', email: 'fan@example.com', name: '', message: '' }),
            ]),
        );
        expect(await LandingLead.announceNew('app-announce', emit)).toBe(0);
        expect(emitted).toHaveLength(2);
        // Its own marker: the digest still has both to send.
        expect(await LandingLead.pendingNotification('app-announce')).toHaveLength(2);
    });

    it('keeps an entry whose announcement failed for the next run', async () => {
        await LandingLead.submit('app-announce-retry', contact);
        await LandingLead.submit('app-announce-retry', { ...contact, name: 'Grace' });
        const down = async () => {
            throw new Error('bus down');
        };
        await expect(LandingLead.announceNew('app-announce-retry', down)).rejects.toThrow('bus down');

        const names: string[] = [];
        expect(await LandingLead.announceNew('app-announce-retry', async (event) => void names.push(event.name))).toBe(
            2,
        );
        expect(names.sort()).toEqual(['Ada', 'Grace']);
    });
});
