import { BaseModel, DomainValidationError, type ModelFields } from '@ottabase/ottaorm';
import { DEFAULT_PAGES, DEFAULT_SITE } from '../defaults';
import { parseLenient } from '../fields';
import { SITE_FIELDS, SiteSettingsSchema, type SiteSettings } from '../site';
import { LandingPage, validated } from './LandingPage';
import { landingSitesTable } from './landing.schema';

export class LandingSite extends BaseModel {
    static entity = 'landing_sites';
    static table = landingSitesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottalanding';
    static packageType = 'package' as const;
    static displayName = 'Landing site';
    static displayNamePlural = 'Landing sites';

    static casts = {
        settings: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['appId', 'settings'],
        update: ['settings'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false },
        appId: { type: 'string', editable: false },
        createdAt: { type: 'number', editable: false },
        updatedAt: { type: 'number', editable: false },
    };

    /** The public read: the app's site, or null until it has been set up. Never writes. */
    static async findForApp(appId: string): Promise<LandingSite | null> {
        return (await this.first({ appId })) as LandingSite | null;
    }

    /**
     * The app's site, seeding starter settings and pages the first time. Idempotent and safe to
     * run concurrently: pages are seeded BEFORE the site row, so the row only exists once seeding
     * finished — a failed or racing first run is simply retried on the next call.
     */
    static async ensureForApp(appId: string): Promise<LandingSite> {
        const existing = await this.findForApp(appId);
        if (existing) return existing;
        for (const page of DEFAULT_PAGES) {
            try {
                await LandingPage.createFor(appId, page);
            } catch (error) {
                // Already there (an earlier partial run, or a concurrent first request).
                if (!(error instanceof DomainValidationError && error.code === 'PATH_TAKEN')) throw error;
            }
        }
        try {
            return (await this.create({ appId, settings: DEFAULT_SITE })) as LandingSite;
        } catch (error) {
            // A concurrent first request won the unique(app_id) race; use its row.
            const winner = await this.findForApp(appId);
            if (winner) return winner;
            throw error;
        }
    }

    static async saveSettings(appId: string, input: unknown): Promise<LandingSite> {
        const settings = validated(SiteSettingsSchema, input);
        const site = await this.ensureForApp(appId);
        await LandingSite.update(site.get('id') as string, { settings });
        return (await this.findForApp(appId)) as LandingSite;
    }

    /**
     * Validated settings. Field by field: a value that no longer fits (e.g. after a rule was
     * tightened) falls back on its own, so one bad field can never replace the whole site.
     */
    getSettings(): SiteSettings {
        return parseLenient(SITE_FIELDS, this.get('settings'), DEFAULT_SITE);
    }
}
