/** Blog-level settings model. */
import { BaseModel, DomainValidationError, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { normalizeBlogLanguages, normalizeLanguageCode, type BlogLanguageConfig } from '../types';
import { ottablogSettingsTable } from './OttablogSettings.schema';

export { ottablogSettingsTable } from './OttablogSettings.schema';
export type { NewOttablogSettingsType, OttablogSettingsType } from './OttablogSettings.schema';

export class OttablogSettings extends BaseModel {
    static entity = 'ottablog_settings';
    static table = ottablogSettingsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    static casts = {
        supportedLanguages: 'json' as const,
        fallbackToDefault: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        defaultLanguage: 'en',
        supportedLanguages: [{ code: 'en', name: 'English', nativeName: 'English' }],
        fallbackToDefault: true,
    };

    static writable = {
        create: ['defaultLanguage', 'supportedLanguages', 'fallbackToDefault', 'appId', 'organizationId'],
        update: ['defaultLanguage', 'supportedLanguages', 'fallbackToDefault'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        defaultLanguage: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Default language', description: 'Language used by the canonical post fields' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        supportedLanguages: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Supported languages',
                description: 'Language codes and display names enabled for this blog',
            },
            formConfig: { visible: true, fieldType: 'json' },
            tableConfig: { visible: false },
        },
        fallbackToDefault: {
            type: 'boolean',
            editable: true,
            uiConfig: {
                label: 'Fallback to default',
                description: 'Show the default language when a translation is unavailable',
            },
            formConfig: { visible: true, fieldType: 'boolean' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        appId: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'App ID' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        organizationId: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Organization ID' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Updated' },
            tableConfig: { visible: false },
        },
    };

    static async forScope(options: {
        appId?: string | null;
        organizationId?: string | null;
    }): Promise<OttablogSettings | null> {
        const where: Record<string, unknown> = {};
        if (options.appId !== undefined) where.appId = options.appId;
        if (options.organizationId !== undefined) where.organizationId = options.organizationId;
        return (await this.first(where)) as OttablogSettings | null;
    }

    static async ensure(options: { appId?: string | null; organizationId?: string | null }): Promise<OttablogSettings> {
        const existing = await this.forScope(options);
        if (existing) return existing;
        try {
            return (await this.create({
                appId: options.appId ?? null,
                organizationId: options.organizationId ?? null,
            })) as OttablogSettings;
        } catch (error) {
            // Two first requests can race before either sees the row. The scope unique index
            // makes one insert win; return that winner instead of surfacing a false 500.
            if (/unique|constraint|duplicate/i.test(error instanceof Error ? error.message : String(error))) {
                const raced = await this.forScope(options);
                if (raced) return raced;
            }
            throw error;
        }
    }

    config(): BlogLanguageConfig {
        const supportedLanguages = normalizeBlogLanguages(this.get('supportedLanguages'));
        const defaultLanguage = normalizeLanguageCode(this.get('defaultLanguage'));
        return {
            defaultLanguage,
            supportedLanguages,
            fallbackToDefault: this.get('fallbackToDefault') !== false,
        };
    }

    async updateLanguages(
        config: Pick<BlogLanguageConfig, 'defaultLanguage' | 'supportedLanguages'> &
            Partial<Pick<BlogLanguageConfig, 'fallbackToDefault'>>,
    ) {
        try {
            const languages = normalizeBlogLanguages(config.supportedLanguages);
            const defaultLanguage = normalizeLanguageCode(config.defaultLanguage);
            if (!languages.some((language) => language.code === defaultLanguage)) {
                throw new DomainValidationError('The default language must be in the supported language list', {
                    status: 422,
                });
            }
            const { Post } = await import('./Post');
            const appId = this.get('appId') as string | null;
            const organizationId = this.get('organizationId') as string | null;
            const canonicalPosts = await Post.where({ appId, organizationId }, { select: ['id', 'language'] });
            const enabled = new Set(languages.map((language) => language.code));
            const unsupportedCanonical = canonicalPosts.find(
                (post) => !enabled.has(normalizeLanguageCode(post.get('language') ?? 'en')),
            );
            if (unsupportedCanonical) {
                throw new DomainValidationError('Cannot disable a language used by a canonical post', {
                    status: 422,
                    code: 'CANONICAL_LANGUAGE_IN_USE',
                });
            }
            this.set('supportedLanguages', languages);
            this.set('defaultLanguage', defaultLanguage);
            if (config.fallbackToDefault !== undefined) this.set('fallbackToDefault', config.fallbackToDefault);
            return await this.save();
        } catch (error) {
            if (error instanceof DomainValidationError) throw error;
            throw new DomainValidationError(error instanceof Error ? error.message : 'Invalid language configuration', {
                status: 422,
            });
        }
    }

    isSupported(language: string): boolean {
        const code = normalizeLanguageCode(language);
        return this.config().supportedLanguages.some((item) => item.code === code);
    }
}
