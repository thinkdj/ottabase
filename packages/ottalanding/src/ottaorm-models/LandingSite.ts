import { BaseModel, type ModelFields } from '@ottabase/ottaorm';
import { DEFAULT_PAGES, DEFAULT_SITE } from '../defaults';
import { SiteSettingsSchema, type SiteSettings } from '../site';
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

    /** The app's site, seeding starter settings and pages the first time. Idempotent. */
    static async ensureForApp(appId: string): Promise<LandingSite> {
        const existing = await this.findForApp(appId);
        if (existing) return existing;
        try {
            const site = (await this.create({ appId, settings: DEFAULT_SITE })) as LandingSite;
            if ((await LandingPage.count({ appId })) === 0) {
                for (const page of DEFAULT_PAGES) await LandingPage.createFor(appId, page);
            }
            return site;
        } catch (error) {
            // A concurrent first request may have won the unique(app_id) race; use its row.
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

    /** Validated settings; falls back to the starter settings if the stored JSON no longer fits. */
    getSettings(): SiteSettings {
        const result = SiteSettingsSchema.safeParse(this.get('settings'));
        return result.success ? result.data : DEFAULT_SITE;
    }
}
