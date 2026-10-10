import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { autoInit, clearConnection, DomainValidationError, registerConnection } from '@ottabase/ottaorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PAGES, DEFAULT_SITE } from '../defaults';
import { LandingPage } from '../ottaorm-models/LandingPage';
import { LandingSite } from '../ottaorm-models/LandingSite';
import { landingPagesTable, landingSitesTable } from '../schema';
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
    const result = await autoInit({ driver, schema: { landingSitesTable, landingPagesTable }, verbose: false });
    expect(result.details.errors).toEqual([]);
    expect(result.details.tablesCreated.sort()).toEqual(['landing_pages', 'landing_sites']);
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
        expect(reread?.toPage().sections.map((s) => s.type)).toEqual(['hero']);
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
