// Headless entry: models, tables, content contracts and theme metadata. No rendered UI —
// the themes' React components live behind `@ottabase/ottalanding/react`.

export { LandingLead } from './ottaorm-models/LandingLead';
export type { LeadOutcome } from './ottaorm-models/LandingLead';
export { LandingPage } from './ottaorm-models/LandingPage';
export { LandingSite } from './ottaorm-models/LandingSite';
export { landingLeadsTable, landingPagesTable, landingSitesTable } from './schema';
export type { LandingLeadRecord, LandingPageRecord, LandingSiteRecord } from './schema';

export { defineFields, fieldErrors, parseLenient, toZod } from './fields';
export type { Data, Field, Fields, GroupField, ListField, ScalarField } from './fields';
export { newSection, parseSections, SECTION_TYPES, SECTIONS, SectionSchema } from './sections';
export type { Section, SectionData, SectionType } from './sections';
export { PAGE_CONTENT_BUDGET_BYTES, PAGE_PATH, PageInputSchema, SITE_FIELDS, SiteSettingsSchema } from './site';
export type { LandingPageData, PageInput, SiteSettings } from './site';
export { getTheme, readableOn, themeAccent, themeFonts, THEMES, themeStyles } from './themes';
export { schemeInitScript, SCHEME_STORAGE_KEY } from './scheme';
export type { ColorScheme, LandingTheme, ThemeId } from './themes';
export { DEFAULT_PAGES, DEFAULT_SITE } from './defaults';
export { SHARE_CARD_SIZE, SHARE_FIELDS } from './share-card';
export type { ShareCard } from './share-card';
// drawShareCard (canvas) is browser-only: `@ottabase/ottalanding/react`.
export {
    LEAD_ENDPOINT,
    LEAD_KINDS,
    LEAD_MIN_FILL_MS,
    LEAD_RATE_LIMIT,
    LeadInputSchema,
    leadDigest,
    leadsToCsv,
} from './leads';
export type { LeadData, LeadInput, LeadKind } from './leads';
export { createOttalandingPackage, OTTALANDING_PACKAGE_KEY, type OttalandingPackageOptions } from './manifest';
