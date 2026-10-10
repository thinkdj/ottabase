// Headless entry: models, tables, content contracts and theme metadata. No rendered UI —
// the themes' React components live behind `@ottabase/ottalanding/react`.

export { LandingPage } from './ottaorm-models/LandingPage';
export { LandingSite } from './ottaorm-models/LandingSite';
export { landingPagesTable, landingSitesTable } from './schema';
export type { LandingPageRecord, LandingSiteRecord } from './schema';

export { defineFields, fieldErrors, toZod } from './fields';
export type { Data, Field, Fields, ListField, ScalarField } from './fields';
export { newSection, parseSections, SECTION_TYPES, SECTIONS, SectionSchema } from './sections';
export type { Section, SectionData, SectionType } from './sections';
export { PAGE_CONTENT_BUDGET_BYTES, PAGE_PATH, PageInputSchema, SITE_FIELDS, SiteSettingsSchema } from './site';
export type { LandingPageData, PageInput, SiteSettings } from './site';
export { getTheme, THEMES, themeStyles } from './themes';
export { schemeInitScript, SCHEME_STORAGE_KEY } from './scheme';
export type { ColorScheme, LandingTheme, ThemeId } from './themes';
export { DEFAULT_PAGES, DEFAULT_SITE } from './defaults';
